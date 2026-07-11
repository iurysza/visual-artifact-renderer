import { describe, it, before } from "node:test"
import { strict as assert } from "node:assert"
import { JSDOM } from "jsdom"
import { createRoot, type Root } from "react-dom/client"
import { act } from "react"

import { VisualArtifactSpecSchema } from "@/lib/contract/artifact-schema"
import type { VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import { AIColabProvider, useAIColabContext } from "./ai-colab-provider"

interface TestAIColabContextValue {
  comments: Array<{ id: string; body: string }>
  setSpec: (spec: VisualArtifactSpec | null) => void
  addArtifactComment: (body: string) => void
  copyToClipboard: () => Promise<void>
}

const baseSpec = VisualArtifactSpecSchema.parse({
  slug: "demo",
  title: "Demo",
  layout: { type: "default" },
  nodes: [{ type: "text", props: { text: "Hello" } }],
}) satisfies VisualArtifactSpec

const sameSlugSpec = VisualArtifactSpecSchema.parse({
  slug: "demo",
  title: "Same slug, different project",
  layout: { type: "default" },
  nodes: [{ type: "text", props: { text: "World" } }],
}) satisfies VisualArtifactSpec

function Harness({ onContext }: { onContext: (ctx: TestAIColabContextValue) => void }) {
  const ctx = useAIColabContext() as TestAIColabContextValue
  onContext(ctx)
  return null
}

describe("AIColabProvider", () => {
  let container: HTMLDivElement
  let root: Root

  before(() => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost:9999/artifacts/",
    })
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    global.window = dom.window as unknown as Window & typeof globalThis
    global.document = dom.window.document
    Object.defineProperty(global, "navigator", {
      value: dom.window.navigator,
      configurable: true,
      writable: true,
    })

    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it("resets comments when project changes while slug stays the same", async () => {
    const ctxRef = { current: null as TestAIColabContextValue | null }
    const setCtx = (c: TestAIColabContextValue) => {
      ctxRef.current = c
    }

    await act(() => {
      root.render(
        <AIColabProvider project="project-a" slug="demo">
          <Harness onContext={setCtx} />
        </AIColabProvider>
      )
    })

    await act(() => {
      ctxRef.current?.setSpec(baseSpec)
    })

    await act(() => {
      ctxRef.current?.addArtifactComment("Comment on project-a")
    })

    if (ctxRef.current) {
      assert.equal(ctxRef.current.comments.length, 1)
    } else {
      assert.fail("expected context to be set")
    }

    await act(() => {
      root.render(
        <AIColabProvider project="project-b" slug="demo">
          <Harness onContext={setCtx} />
        </AIColabProvider>
      )
    })

    await act(() => {
      ctxRef.current?.setSpec(sameSlugSpec)
    })

    if (ctxRef.current) {
      assert.equal(ctxRef.current.comments.length, 0)
    } else {
      assert.fail("expected context to be set")
    }
  })

  it("plumbs the artifact data path to the clipboard", async () => {
    const written: string[] = []
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: (text: string) => Promise.resolve(written.push(text)) },
      configurable: true,
    })

    const ctxRef = { current: null as TestAIColabContextValue | null }
    const setCtx = (c: TestAIColabContextValue) => {
      ctxRef.current = c
    }

    await act(() => {
      root.render(
        <AIColabProvider project="demo" slug="slug">
          <Harness onContext={setCtx} />
        </AIColabProvider>
      )
    })

    await act(() => {
      ctxRef.current?.setSpec(baseSpec)
      ctxRef.current?.addArtifactComment("Feedback")
    })

    await act(() => {
      void ctxRef.current?.copyToClipboard()
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(written.length, 1)
    assert.ok(written[0].includes("/artifacts/data/artifacts/demo/slug/artifact.json"))
    assert.ok(written[0].includes("Feedback"))
  })
})
