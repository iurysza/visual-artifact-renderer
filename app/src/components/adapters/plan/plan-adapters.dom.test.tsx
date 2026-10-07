import { describe, it, before, after } from "node:test"
import { strict as assert } from "node:assert"
import { JSDOM } from "jsdom"
import { createRoot, type Root } from "react-dom/client"
import { act, type ReactNode } from "react"

import type { ArtifactRenderContext, RenderNodes } from "@/components/artifact-types"
import type { ArtifactNode, VisualArtifactSpec } from "@/lib/contract/artifact-schema"

let container: HTMLDivElement
let root: Root

// Minimal stand-in for the renderer: real registry + plan provider, no annotation/AI providers.
async function render(spec: Pick<VisualArtifactSpec, "title" | "nodes">) {
  const { componentRegistry } = await import("@/components/component-registry")
  const { DecisionAnswersProvider } = await import("@/components/plan/decision-answers")
  const renderNodes: RenderNodes = (nodes, context, prefix = "nodes") =>
    nodes?.map((node, index) => {
      const nodePath = `${prefix}.${index}`
      const Component = componentRegistry[node.type] as (args: unknown) => ReactNode
      const children = "children" in node && node.children ? renderNodes(node.children, context, `${nodePath}.children`) : undefined
      return <div key={nodePath} data-node-path={nodePath}>{Component({ node, context, children, renderNodes, nodePath })}</div>
    })
  const context: ArtifactRenderContext = { project: "p", slug: "t", data: undefined }
  await act(async () => {
    root.render(<DecisionAnswersProvider spec={spec}>{renderNodes(spec.nodes, context)}</DecisionAnswersProvider>)
  })
}

const decision = (id: string): ArtifactNode =>
  ({
    type: "decision",
    props: { id, question: `Pick ${id}?`, options: [{ id: "a", label: "Option A", suggested: true }, { id: "b", label: "Option B" }] },
  }) as ArtifactNode
const claim = (text: string, children: ArtifactNode[] = []): ArtifactNode => ({ type: "claim", props: { text }, children }) as ArtifactNode

describe("plan adapters (DOM)", () => {
  before(() => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: "http://localhost:9412/p/t/" })
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    global.window = dom.window as unknown as Window & typeof globalThis
    global.document = dom.window.document
    Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true })
    for (const key of ["HTMLElement", "Node", "MutationObserver", "getComputedStyle", "KeyboardEvent", "Event", "SVGElement", "CSS"] as const) {
      ;(globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key]
    }
    if (!("CSS" in globalThis) || !globalThis.CSS) (globalThis as Record<string, unknown>).CSS = { escape: (s: string) => s }
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0) as unknown as number
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })
  after(() => act(() => root.unmount()))

  it("open: needs expands exactly claims 1, 2 and 2.1 (D10)", async () => {
    await render({
      title: "Needs",
      nodes: [
        {
          type: "claim-tree",
          props: { open: "needs", contents: false },
          children: [claim("One", [decision("first"), claim("One one")]), claim("Two", [claim("Two one", [decision("second")])]), claim("Three")],
        } as ArtifactNode,
      ],
    })
    const expanded = [...container.querySelectorAll("section[data-claim]")]
      .filter((section) => section.querySelector(":scope > div > button[aria-expanded]")?.getAttribute("aria-expanded") === "true")
      .map((section) => section.getAttribute("data-claim"))
    assert.deepEqual(expanded, ["1", "2", "2.1"])
    assert.equal(container.querySelector("#claim-1-1-body")?.hasAttribute("hidden"), true)
  })

  it("toggles a claim, and [ / ] collapse and expand all", async () => {
    const toggle = container.querySelector<HTMLButtonElement>("#claim-3-toggle")!
    await act(async () => toggle.click())
    assert.equal(toggle.getAttribute("aria-expanded"), "true")
    const press = (key: string) => toggle.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }))
    await act(async () => press("["))
    assert.equal(container.querySelectorAll('button[aria-expanded="true"][id$="-toggle"]').length, 0)
    await act(async () => press("]"))
    assert.equal(container.querySelectorAll('button[aria-expanded="true"][id$="-toggle"]').length, 5)
  })

  it("numbers decisions and records reader changes", async () => {
    const cards = container.querySelectorAll("fieldset[data-decision]")
    assert.equal(cards.length, 2)
    assert.match(cards[1].textContent ?? "", /Decision 2 of 2/)
    assert.equal(cards[1].getAttribute("data-source"), "suggested")
    const optionB = cards[1].querySelector<HTMLInputElement>('input[value="b"]')!
    await act(async () => optionB.click())
    assert.equal(container.querySelectorAll("fieldset[data-decision]")[1].getAttribute("data-source"), "reader")
    assert.ok(container.querySelector("[data-plan-copy]"), "one copy button at the end of the tree")
  })

  it("state machine selects states and steps traces", async () => {
    await render({
      title: "Machine",
      nodes: [
        {
          type: "state-machine",
          props: {
            initial: "idle",
            states: [{ id: "idle", screen: "s-idle" }, { id: "busy", screen: "s-busy" }, { id: "done", final: true }],
            events: ["idle -start-> busy", "busy -finish-> done"],
            traces: [{ name: "happy", events: ["start", "finish"] }],
          },
          children: [
            { type: "text", props: { text: "idle screen" }, metadata: { id: "s-idle" } },
            { type: "text", props: { text: "busy screen" }, metadata: { id: "s-busy" } },
          ],
        } as ArtifactNode,
      ],
    })
    const screens = container.querySelectorAll<HTMLElement>("[data-screen]")
    assert.deepEqual([...screens].map((s) => s.hidden), [false, true])
    const busy = container.querySelector<SVGGElement>('[data-state="busy"]')!
    await act(async () => busy.dispatchEvent(new window.MouseEvent("click", { bubbles: true })))
    assert.equal(container.querySelector('[data-state="busy"]')?.getAttribute("aria-pressed"), "true", "click selects busy")
    assert.deepEqual([...container.querySelectorAll<HTMLElement>("[data-screen]")].map((s) => s.hidden), [true, false])
    const trace = container.querySelector<HTMLButtonElement>('button[aria-label="Step trace happy"]')!
    await act(async () => trace.click())
    await act(async () => trace.click())
    assert.equal(container.querySelector('[data-state="busy"]')?.getAttribute("aria-pressed"), "true", "trace step 2 is busy")
  })
})
