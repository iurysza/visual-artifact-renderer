import { describe, it, before } from "node:test"
import { strict as assert } from "node:assert"
import { JSDOM } from "jsdom"
import { createRoot, type Root } from "react-dom/client"
import { act } from "react"

import { AnnotationProvider, useAnnotationContext } from "./annotation-provider"
import type { AnnotationAnchor, AnnotationDocument } from "@/lib/artifacts/annotations"

interface TestAnnotationContextValue {
  doc: AnnotationDocument | null
  isSaving: boolean
  createThread: (anchor: AnnotationAnchor, body: string) => Promise<void>
  addReply: (threadId: string, body: string) => Promise<void>
  editMessage: (threadId: string, messageId: string, body: string) => Promise<void>
}

function Harness({ onContext }: { onContext: (ctx: TestAnnotationContextValue) => void }) {
  const ctx = useAnnotationContext() as TestAnnotationContextValue
  onContext(ctx)
  return null
}

describe("AnnotationProvider queue and reconciliation", () => {
  let container: HTMLDivElement
  let root: Root
  let fetches: Array<{ url: string; init?: RequestInit; body?: unknown }>

  function setupFetch(defaultDoc: AnnotationDocument) {
    fetches = []
    const serverThreads: AnnotationDocument["threads"] = [...defaultDoc.threads]

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      const bodyText = init?.body ? String(init.body) : undefined
      const body = bodyText ? (JSON.parse(bodyText) as unknown) : undefined
      fetches.push({ url, init, body })

      if (url.endsWith("/annotations/author")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ name: "Test Author", email: "test@example.com" }),
          text: async () => JSON.stringify({ name: "Test Author", email: "test@example.com" }),
          headers: new Headers({ "Content-Type": "application/json" }),
        } as Response
      }

      if (url.endsWith("/annotations.json")) {
        const doc = { ...defaultDoc, threads: [...serverThreads] }
        return {
          ok: true,
          status: 200,
          json: async () => doc,
          text: async () => JSON.stringify(doc),
          headers: new Headers({ "Content-Type": "application/json" }),
        } as Response
      }

      if (url.includes("/api/annotations/")) {
        const mutations = Array.isArray(body) ? body : []
        const shouldFail = mutations.some(
          (m: unknown) =>
            typeof m === "object" &&
            m !== null &&
            "type" in m &&
            m.type === "createThread" &&
            typeof (m as { thread?: { messages?: Array<{ body?: string }> } }).thread?.messages?.[0]?.body === "string" &&
            (m as { thread?: { messages?: Array<{ body?: string }> } }).thread!.messages![0].body!.includes("fail"),
        )
        if (shouldFail) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: "first failed" }),
            text: async () => "first failed",
            headers: new Headers({ "Content-Type": "application/json" }),
          } as Response
        }

        for (const mutation of mutations) {
          if (typeof mutation !== "object" || mutation === null) continue
          if (mutation.type === "createThread" && "thread" in mutation) {
            serverThreads.push(mutation.thread as AnnotationDocument["threads"][number])
          } else if (mutation.type === "addMessage" && "threadId" in mutation && "message" in mutation) {
            const thread = serverThreads.find((t) => t.id === mutation.threadId)
            if (thread) thread.messages.push(mutation.message as AnnotationDocument["threads"][number]["messages"][number])
          }
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ ...defaultDoc, threads: [...serverThreads] }),
          text: async () => JSON.stringify({ ...defaultDoc, threads: [...serverThreads] }),
          headers: new Headers({ "Content-Type": "application/json" }),
        } as Response
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
        headers: new Headers({ "Content-Type": "application/json" }),
      } as Response
    }) as typeof fetch
  }

  before(() => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost:9999/artifacts/demo/slug/",
    })
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    global.window = dom.window as unknown as Window & typeof globalThis
    global.document = dom.window.document
    Object.defineProperty(global, "navigator", {
      value: dom.window.navigator,
      configurable: true,
      writable: true,
    })

    window.matchMedia = () =>
      ({
        matches: false,
        media: "",
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
      }) as unknown as MediaQueryList

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it("serializes two rapid mutations and keeps authoritative responses", async () => {
    const ctxRef = { current: null as TestAnnotationContextValue | null }
    const setCtx = (c: TestAnnotationContextValue) => {
      ctxRef.current = c
    }

    setupFetch({ version: 1, project: "demo", slug: "slug", threads: [] })

    await act(() => {
      root.render(
        <AnnotationProvider project="demo" slug="slug">
          <Harness onContext={setCtx} />
        </AnnotationProvider>
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    assert.equal(ctxRef.current?.doc?.threads.length, 0)

    const first = ctxRef.current!.createThread({ nodePath: "nodes.0", nodeType: "text" }, "first")
    const second = ctxRef.current!.createThread({ nodePath: "nodes.1", nodeType: "text" }, "second")

    await act(async () => {
      await Promise.all([first, second])
    })

    assert.equal(fetches.filter((f) => f.init?.method === "POST").length, 2)
    assert.equal(ctxRef.current?.doc?.threads.length, 2)
    assert.equal(ctxRef.current?.isSaving, false)
  })

  it("rolls back a failed first mutation before the second succeeds", async () => {
    const ctxRef = { current: null as TestAnnotationContextValue | null }
    const setCtx = (c: TestAnnotationContextValue) => {
      ctxRef.current = c
    }

    setupFetch({ version: 1, project: "demo", slug: "slug", threads: [] })

    await act(() => {
      root.render(
        <AnnotationProvider project="demo" slug="slug">
          <Harness onContext={setCtx} />
        </AnnotationProvider>
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    const first = ctxRef.current!.createThread({ nodePath: "nodes.0", nodeType: "text" }, "first fail")
    const second = ctxRef.current!.createThread({ nodePath: "nodes.1", nodeType: "text" }, "second success")

    await act(async () => {
      await Promise.all([first, second])
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    assert.equal(ctxRef.current?.doc?.threads.length, 1)
    assert.equal(ctxRef.current?.doc?.threads[0].messages[0].body, "second success")
  })
})
