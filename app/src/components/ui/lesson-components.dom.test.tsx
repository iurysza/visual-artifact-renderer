import { afterEach, before, beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

import { KnowledgeCheck } from "@/components/ui/knowledge-check"
import { VisualSequence } from "@/components/ui/visual-sequence"

let container: HTMLDivElement
let root: Root

before(() => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "http://localhost:9999/artifacts/",
  })
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  global.window = dom.window as unknown as Window & typeof globalThis
  global.document = dom.window.document
  global.HTMLElement = dom.window.HTMLElement
  global.Element = dom.window.Element
  global.Node = dom.window.Node
  global.Event = dom.window.Event
  global.MouseEvent = dom.window.MouseEvent
  Object.defineProperty(global, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  })
})

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
})

function buttonByText(text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  )
  assert.ok(button, `expected button ${text}`)
  return button as HTMLButtonElement
}

describe("KnowledgeCheck", () => {
  it("shows specific feedback after submission and supports retry", async () => {
    await act(() => {
      root.render(
        <KnowledgeCheck
          prompt="Which layer owns styling?"
          choices={[
            { id: "agent", label: "Agent", feedback: "The agent only chooses semantic nodes." },
            { id: "renderer", label: "Renderer" },
          ]}
          answerId="renderer"
          explanation="The renderer owns visual behavior and accessibility."
        />,
      )
    })

    assert.equal(buttonByText("Check answer").disabled, true)

    const radios = container.querySelectorAll<HTMLElement>("[data-slot='radio-group-item']")
    assert.equal(radios.length, 2)
    await act(() => radios[0].click())
    assert.equal(buttonByText("Check answer").disabled, false)

    await act(() => buttonByText("Check answer").click())
    assert.match(container.textContent ?? "", /Not quite/)
    assert.match(container.textContent ?? "", /only chooses semantic nodes/)
    assert.match(container.textContent ?? "", /renderer owns visual behavior/)

    await act(() => buttonByText("Try again").click())
    assert.doesNotMatch(container.textContent ?? "", /Not quite/)
    assert.equal(buttonByText("Check answer").disabled, true)
  })
})

describe("VisualSequence", () => {
  it("moves through frames and disables navigation at the bounds", async () => {
    await act(() => {
      root.render(
        <VisualSequence
          title="Trace the request"
          items={[{ title: "Validate" }, { title: "Render" }]}
          renderFrame={(index) => <p>Frame {index + 1}</p>}
        />,
      )
    })

    assert.match(container.textContent ?? "", /Frame 1/)
    assert.equal(buttonByText("Previous").disabled, true)

    await act(() => buttonByText("Next").click())
    assert.match(container.textContent ?? "", /Frame 2/)
    assert.doesNotMatch(container.textContent ?? "", /Frame 1/)
    assert.equal(buttonByText("Next").disabled, true)
  })
})
