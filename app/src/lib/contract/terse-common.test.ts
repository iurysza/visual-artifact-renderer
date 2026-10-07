import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { checkGrid, parseGridRows, parseMarkPrefix } from "@/lib/contract/artifact-manifest"

describe("parseMarkPrefix", () => {
  it("reads the four marks and defaults to context", () => {
    assert.deepEqual(parseMarkPrefix("+ added()"), { mark: "added", rest: "added()" })
    assert.deepEqual(parseMarkPrefix("- gone()"), { mark: "removed", rest: "gone()" })
    assert.deepEqual(parseMarkPrefix("~   changed()"), { mark: "changed", rest: "changed()" })
    assert.deepEqual(parseMarkPrefix("? maybe()"), { mark: "proposed", rest: "maybe()" })
    assert.deepEqual(parseMarkPrefix("  plain()"), { mark: "context", rest: "plain()" })
    assert.deepEqual(parseMarkPrefix("plain()"), { mark: "context", rest: "plain()" })
  })

  it("treats a mark glued to text as plain text", () => {
    assert.deepEqual(parseMarkPrefix("-flag"), { mark: "context", rest: "-flag" })
    assert.deepEqual(parseMarkPrefix("~/path"), { mark: "context", rest: "~/path" })
  })
})

describe("parseGridRows", () => {
  it("parses the string form with all empty-cell tokens", () => {
    const { cells, errors } = parseGridRows(["| a | b | . |", "| · | c |  |"])
    assert.deepEqual(errors, [])
    assert.deepEqual(cells, [
      ["a", "b", null],
      [null, "c", null],
    ])
  })

  it("parses the array form", () => {
    const { cells, errors } = parseGridRows([
      ["a", null, "b"],
      [".", "c", ""],
    ])
    assert.deepEqual(errors, [])
    assert.deepEqual(cells, [
      ["a", null, "b"],
      [null, "c", null],
    ])
  })

  it("reports a malformed string row with its line", () => {
    const { errors } = parseGridRows(["| a |", "a | b"])
    assert.equal(errors.length, 1)
    assert.equal(errors[0].index, 1)
    assert.equal(errors[0].line, 2)
  })
})

describe("checkGrid", () => {
  it("accepts a grid where every id sits in exactly one cell", () => {
    const { cells } = parseGridRows(["| a | b |", "| . | c |"])
    assert.deepEqual(checkGrid(cells, ["a", "b", "c"], "node"), [])
  })

  it("reports an unknown id with the row number", () => {
    const { cells } = parseGridRows(["| a | b |", "| x | . |"])
    assert.deepEqual(checkGrid(cells, ["a", "b"], "node"), [
      { index: 1, line: 2, message: 'grid row 2: unknown node "x"' },
    ])
  })

  it("reports a duplicate cell", () => {
    const { cells } = parseGridRows(["| a | b |", "| a | . |"])
    assert.deepEqual(checkGrid(cells, ["a", "b"], "state"), [
      { index: 1, line: 2, message: 'grid: "a" appears twice' },
    ])
  })

  it("reports a missing cell", () => {
    const { cells } = parseGridRows(["| a | . |"])
    assert.deepEqual(checkGrid(cells, ["a", "b"], "state"), [
      { index: 0, message: 'grid: state "b" has no cell' },
    ])
  })
})
