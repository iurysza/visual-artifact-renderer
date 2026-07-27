import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { renderExecutionTrace } from "./execution-trace-adapter"

const sourceContent = [
  "export function formatFooter(windows: number[]) {",
  "  return windows.filter(Boolean)",
  "    .map((window) => formatFooterWindow(window))",
  "}",
].join("\n")

const node = {
  type: "execution-trace" as const,
  props: {
    title: "OpenAI quota execution path",
    provenance: {
      mode: "inferred" as const,
      method: "static-analysis" as const,
      summary: "Source-derived review path.",
      confidence: "high" as const,
    },
    events: [{
      id: "format-footer",
      order: 0,
      phase: "output" as const,
      kind: "boundary" as const,
      label: "Format 24% for the footer",
      source: {
        content: sourceContent,
        facts: {
          span: { file: "src/format.ts", startLine: 3, endLine: 3 },
          excerpt: "    .map((window) => formatFooterWindow(window))",
          sourceHash: "0".repeat(64),
          worktree: "dirty" as const,
          language: "typescript" as const,
          syntaxKind: "call_expression",
          focus: {
            kind: "call" as const,
            text: "formatFooterWindow(window)",
            symbol: "formatFooterWindow",
          },
          scope: {
            kind: "function" as const,
            symbol: "formatFooter",
            startLine: 1,
            endLine: 4,
          },
          resolution: "resolved" as const,
        },
      },
      boundary: {
        kind: "output" as const,
        from: { label: "Normalized ProviderQuota", system: "runtime" as const },
        to: { label: "Pi status footer", system: "renderer" as const },
        outcome: "passed" as const,
      },
      evidence: { origin: "derived" as const, confidence: "high" as const },
    }],
  },
}

describe("execution trace adapter", () => {
  it("renders verified code identity separately from narrative", () => {
    const html = renderToStaticMarkup(renderExecutionTrace({ node } as never))

    assert.match(html, /Call stack/)
    assert.match(html, /formatFooterWindow\(\)/)
    assert.match(html, /inside formatFooter\(\)/)
    assert.match(html, /Format 24% for the footer/)
    assert.match(html, /src\/format\.ts:3/)
    assert.match(html, /aria-label="About this trace"/)
    assert.doesNotMatch(html, /source-derived/)
    assert.doesNotMatch(html, /Source-derived review path/)
    assert.match(html, /Normalized ProviderQuota/)
    assert.match(html, /Pi status footer/)
  })
})
