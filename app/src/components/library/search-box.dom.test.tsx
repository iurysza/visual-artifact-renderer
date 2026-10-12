import assert from "node:assert/strict"
import { after, test } from "node:test"
import { JSDOM } from "jsdom"
import type { Root } from "react-dom/client"
import type { SearchCatalog } from "@/lib/artifacts/library-suggest"

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" })
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  DocumentFragment: dom.window.DocumentFragment,
  MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
}

after(() => { dom.window.close() })

const catalog: SearchCatalog = {
  types: [{ value: "review", count: 4 }, { value: "report", count: 2 }],
  projects: [{ value: "var", count: 3 }],
  topics: [],
  states: [{ value: "open", count: 2 }],
  comments: 2,
  dates: [
    { value: "today", label: "Today", count: 1, preset: true },
    { value: "week", label: "This week", count: 3, preset: true },
    { value: "30d", label: "Last 30 days", count: 6, preset: true },
    { value: ">7d", label: "Newer than 7 days", count: 4, preset: false },
    { value: ">30d", label: "Newer than 30 days", count: 6, preset: false },
  ],
}

async function typeInto(input: HTMLInputElement, value: string) {
  const { act } = await import("react")
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
    assert.ok(setter)
    setter.call(input, value)
    input.setSelectionRange(value.length, value.length)
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
  })
}

function press(input: HTMLInputElement, key: string) {
  const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  input.dispatchEvent(event)
  return event
}

function options(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="option"]')]
}

test("search combobox completes qualifiers from the keyboard and the pointer", async () => {
  const { createRoot } = await import("react-dom/client")
  const { act, useRef, useState } = await import("react")
  const { SearchBox } = await import("./library-parts")
  const { suggestQualifiers } = await import("@/lib/artifacts/library-suggest")

  function Harness() {
    const [value, setValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    return (
      <SearchBox
        value={value}
        onChange={setValue}
        placeholder="Search"
        inputRef={inputRef}
        label="Search the library"
        suggest={(raw, cursor) => suggestQualifiers(raw, cursor, catalog)}
      />
    )
  }

  const container = document.getElementById("root")
  assert.ok(container)
  const root: Root = createRoot(container)
  try {
    await act(async () => { root.render(<Harness />) })
    const input = container.querySelector("input")
    assert.ok(input)

    await act(async () => { input.focus() })
    const list = container.querySelector('[role="listbox"]')
    assert.ok(list)
    assert.equal(input.getAttribute("role"), "combobox")
    assert.equal(input.getAttribute("aria-expanded"), "true")
    assert.equal(input.getAttribute("aria-autocomplete"), "list")
    assert.equal(input.getAttribute("aria-controls"), list.id)
    assert.ok(options(container).some((option) => option.textContent?.includes("type:")))

    await typeInto(input, "ty")
    assert.deepEqual(options(container).map((option) => option.textContent), ["type:Artifact type"])
    assert.equal(input.getAttribute("aria-activedescendant"), options(container)[0]?.id)

    await act(async () => { press(input, "Enter") })
    assert.equal(input.value, "type:")
    assert.deepEqual(options(container).map((option) => option.textContent), ["review4", "report2"])

    await act(async () => { press(input, "ArrowDown") })
    const report = options(container)[1]
    assert.ok(report)
    assert.equal(report.getAttribute("aria-selected"), "true")
    assert.equal(input.getAttribute("aria-activedescendant"), report.id)

    const tab = await act(async () => press(input, "Tab"))
    assert.equal(tab?.defaultPrevented, true)
    assert.equal(input.value, "type:report ")

    await typeInto(input, "type:report date:")
    assert.deepEqual(options(container).map((option) => option.querySelector("span")?.textContent), ["Today", "This week", "Last 30 days"])
    const today = options(container)[0]
    assert.ok(today)
    await act(async () => {
      today.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }))
      today.click()
    })
    assert.equal(input.value, "type:report date:today ")

    await act(async () => { press(input, "Escape") })
    assert.equal(container.querySelector('[role="listbox"]'), null)
    assert.equal(input.getAttribute("aria-expanded"), "false")
    assert.equal(input.value, "type:report date:today ")
    await act(async () => { press(input, "Escape") })
    assert.equal(input.value, "")

    await typeInto(input, "created:")
    assert.equal(container.querySelector('[role="listbox"]'), null)
    await typeInto(input, "tag:react")
    assert.equal(container.querySelector('[role="listbox"]'), null)
  } finally {
    await act(async () => { root.unmount() })
  }
})
