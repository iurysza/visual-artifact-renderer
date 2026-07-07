import { validateMermaid, formatValidationReport } from "@agents/visual-artifact-annotations/mermaid-validator"

import { ValidationError } from "./validate.ts"

interface MermaidNode {
  code: string
  path: string
}

/**
 * Walk a validated spec and collect every `mermaid` node's `code` along with
 * a human-readable path. Mirrors the nesting shapes accepted by `validateNode`
 * (container children, section/card/grid `props.children`, and tabs/accordion
 * `props.items[].nodes`).
 */
function collectMermaidNodes(node: unknown, path: string, acc: MermaidNode[]): void {
  if (!node || typeof node !== "object") return
  const obj = node as Record<string, unknown>

  if (obj.type === "mermaid") {
    const props = (obj.props ?? {}) as Record<string, unknown>
    if (typeof props.code === "string" && props.code.length > 0) {
      acc.push({ code: props.code, path: `${path}<mermaid>` })
    }
    return
  }

  const visitNodes = (nodes: unknown, base: string): void => {
    if (!Array.isArray(nodes)) return
    nodes.forEach((child, index) => collectMermaidNodes(child, `${base}.children[${index}]`, acc))
  }

  visitNodes(obj.children, path)

  if (obj.props && typeof obj.props === "object") {
    const props = obj.props as Record<string, unknown>
    visitNodes(props.children, `${path}.props`)

    // tabs / accordion: each item carries its own `nodes` array
    if (Array.isArray(props.items)) {
      props.items.forEach((item, index) => {
        if (item && typeof item === "object" && Array.isArray((item as Record<string, unknown>).nodes)) {
          visitNodes((item as Record<string, unknown>).nodes, `${path}.props.items[${index}]`)
        }
      })
    }
  }
}

/**
 * Validate every mermaid diagram in the spec using the official `mermaid.parse()`
 * API. Throws a `ValidationError` with a formatted report on the first broken
 * diagram so `create`/`validate` fail before the artifact is stored or served.
 */
export async function validateMermaidNodes(spec: { nodes: unknown[] }): Promise<void> {
  const collected: MermaidNode[] = []
  spec.nodes.forEach((node, index) => collectMermaidNodes(node, `nodes[${index}]`, collected))

  if (collected.length === 0) return

  for (const { code, path } of collected) {
    const result = await validateMermaid(code)
    if (!result.valid) {
      const report = formatValidationReport(result)
      throw new ValidationError(
        `Mermaid diagram at ${path} is invalid and would not render:\n${report}`,
      )
    }
  }
}
