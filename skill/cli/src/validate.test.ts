import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { ArtifactContract, ArtifactSpec } from "./types.ts"
import { validateSpec, ValidationError } from "./validate.ts"

const contract = JSON.parse(
  readFileSync(resolve(import.meta.dir, "..", "..", "artifact-contract.json"), "utf8"),
) as ArtifactContract

function specWith(node: unknown): ArtifactSpec {
  return {
    slug: "validation-regression",
    title: "Validation Regression",
    nodes: [node],
  }
}

function expectInvalid(node: unknown, message: string): void {
  expect(() => validateSpec(specWith(node), contract)).toThrow(ValidationError)
  expect(() => validateSpec(specWith(node), contract)).toThrow(message)
}

describe("validateSpec contract parity", () => {
  test("rejects slugs longer than the renderer accepts", () => {
    const spec = specWith({ type: "text", props: { text: "Hi" } })
    spec.slug = "a".repeat(81)

    expect(() => validateSpec(spec, contract)).toThrow(ValidationError)
    expect(() => validateSpec(spec, contract)).toThrow("max allowed is 80")
  })

  test("rejects invalid stepper statuses before artifacts are written", () => {
    expectInvalid(
      {
        type: "stepper",
        props: { items: [{ title: "Deploy", status: "todo" }] },
      },
      "must be one of: complete, current, pending",
    )
  })

  test("accepts valid stepper statuses", () => {
    const result = validateSpec(
      specWith({
        type: "stepper",
        props: { items: [{ title: "Deploy", status: "pending" }] },
      }),
      contract,
    )

    expect(result.slug).toBe("validation-regression")
  })

  test("rejects malformed nested object-array items", () => {
    expectInvalid(
      {
        type: "stepper",
        props: { items: [{ title: "Deploy", status: "pending", unexpected: "nope" }] },
      },
      "unexpected",
    )
  })

  test("rejects file-tree item types outside the renderer enum", () => {
    expectInvalid(
      {
        type: "file-tree",
        props: { items: [{ name: "src", type: "folder" }] },
      },
      "must be one of: file, directory",
    )
  })

  test("accepts valid minimal file-tree items", () => {
    const result = validateSpec(
      specWith({
        type: "file-tree",
        props: { items: [{ name: "README.md" }] },
      }),
      contract,
    )

    expect(result.nodes).toHaveLength(1)
  })

  test("rejects flow diagrams with too few items", () => {
    expectInvalid(
      {
        type: "flow",
        props: { items: [{ title: "Only one" }] },
      },
      "must have at least 2 items",
    )
  })

  test("rejects empty column arrays", () => {
    expectInvalid(
      {
        type: "table",
        props: { dataKey: "rows", columns: [] },
      },
      "must be a non-empty array",
    )
  })

  test("rejects extra keys in column objects", () => {
    expectInvalid(
      {
        type: "table",
        props: { dataKey: "rows", columns: [{ key: "name", extra: "nope" }] },
      },
      "extra",
    )
  })

  test("rejects extra keys in tab items", () => {
    expectInvalid(
      {
        type: "tabs",
        props: {
          items: [{ value: "one", label: "One", nodes: [{ type: "text", props: { text: "Hi" } }], extra: "nope" }],
        },
      },
      "extra",
    )
  })

  test("rejects file URLs blocked by the renderer schema", () => {
    expectInvalid(
      {
        type: "image",
        props: { src: "file:///tmp/secret.png", alt: "Secret" },
      },
      "must not use file:// URLs",
    )
  })

  test("rejects non-integer diagram heights", () => {
    expectInvalid(
      {
        type: "mermaid",
        props: { code: "flowchart LR\n  A --> B", height: 240.5 },
      },
      "must be an integer",
    )
  })
})
