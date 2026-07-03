import { describe, it, before } from "node:test"
import { strict as assert } from "node:assert"
import { JSDOM } from "jsdom"

import { findAnchorElement, isAnchorOrphaned } from "./annotation-helpers"

describe("anchor DOM helpers", () => {
  before(() => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`)
    global.window = dom.window as unknown as Window & typeof globalThis
    global.document = dom.window.document
  })

  it("finds element by stable node id when id attribute exists", () => {
    const el = document.createElement("div")
    el.setAttribute("data-va-node-id", "stable-node")
    el.setAttribute("data-va-node-path", "nodes.0")
    document.body.appendChild(el)

    const found = findAnchorElement("stable-node", "nodes.0")
    assert.equal(found, el)

    document.body.innerHTML = ""
  })

  it("falls back to node path when id is missing", () => {
    const el = document.createElement("div")
    el.setAttribute("data-va-node-id", "other")
    el.setAttribute("data-va-node-path", "nodes.1")
    document.body.appendChild(el)

    const found = findAnchorElement(undefined, "nodes.1")
    assert.equal(found, el)

    document.body.innerHTML = ""
  })

  it("prefers node id over path when both match", () => {
    const byId = document.createElement("div")
    byId.setAttribute("data-va-node-id", "stable-node")
    byId.setAttribute("data-va-node-path", "nodes.0")

    const byPath = document.createElement("div")
    byPath.setAttribute("data-va-node-id", "different")
    byPath.setAttribute("data-va-node-path", "nodes.0")

    document.body.appendChild(byId)
    document.body.appendChild(byPath)

    const found = findAnchorElement("stable-node", "nodes.0")
    assert.equal(found, byId)

    document.body.innerHTML = ""
  })

  it("reports orphaned anchor when no element matches", () => {
    document.body.innerHTML = ""
    assert.equal(isAnchorOrphaned("missing", "nodes.99"), true)
  })
})
