import { describe, expect, test } from "bun:test"

import { validateMermaidNodes } from "./mermaid.ts"
import { ValidationError } from "./validate.ts"

function specWith(nodes: unknown[]): { nodes: unknown[] } {
  return { nodes }
}

describe("validateMermaidNodes", () => {
  test("passes when there are no mermaid nodes", async () => {
    await validateMermaidNodes(
      specWith([{ type: "text", props: { text: "hi" } }]),
    )
  })

  test("accepts a valid flowchart", async () => {
    await validateMermaidNodes(
      specWith([
        { type: "mermaid", props: { code: "flowchart TD\n  A --> B" } },
      ]),
    )
  })

  test("rejects an incomplete flowchart link (A -- B)", async () => {
    const spec = specWith([
      { type: "mermaid", props: { code: "graph TD\n  A -- B" } },
    ])

    await expect(validateMermaidNodes(spec)).rejects.toThrow(ValidationError)
    await expect(validateMermaidNodes(spec)).rejects.toThrow(
      /Mermaid diagram at nodes\[0\]<mermaid> is invalid/,
    )
    await expect(validateMermaidNodes(spec)).rejects.toThrow(
      /flowchart-invalid-link/,
    )
  })

  test("rejects an unknown diagram type", async () => {
    const spec = specWith([
      { type: "mermaid", props: { code: "archchart TD\n  A --> B" } },
    ])

    await expect(validateMermaidNodes(spec)).rejects.toThrow(
      /unknown-diagram-type/,
    )
  })

  test("reports the path of a mermaid node nested inside tabs", async () => {
    const spec = specWith([
      {
        type: "tabs",
        props: {
          items: [
            {
              value: "a",
              label: "A",
              nodes: [
                { type: "mermaid", props: { code: "flowchart TD\n  A -- B" } },
              ],
            },
          ],
        },
      },
    ])

    await expect(validateMermaidNodes(spec)).rejects.toThrow(
      /nodes\[0\]\.props\.items\[0\]\.children\[0\]<mermaid>/,
    )
  })

  test("stops at the first broken diagram", async () => {
    const spec = specWith([
      { type: "mermaid", props: { code: "flowchart TD\n  A --> B" } },
      { type: "mermaid", props: { code: "graph TD\n  A -- B" } },
      { type: "mermaid", props: { code: "flowchart TD\n  C --> D" } },
    ])

    await expect(validateMermaidNodes(spec)).rejects.toThrow(
      /nodes\[1\]<mermaid>/,
    )
  })
})
