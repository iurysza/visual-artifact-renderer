import { describe, expect, test } from "bun:test"
import { parseVisualArtifactSpec } from "@agents/visual-artifact-annotations/contract"
import { portArtifactSpec } from "./port-contract-3.ts"

function port(spec: Record<string, unknown>) {
  const result = portArtifactSpec({ slug: "sample", title: "Sample", ...spec })
  return parseVisualArtifactSpec(result.spec)
}

describe("portArtifactSpec", () => {
  test("maps a page of removed nodes onto contract 3", () => {
    const spec = port({
      description: "A short page",
      data: {
        checks: [
          { name: "Worker", status: "ok" },
          { name: "R2", status: "warn", notes: "bucket list is slow" },
        ],
        points: [
          { race: "Berlin", time_min: 208 },
          { race: "Nice", time_min: 200 },
        ],
      },
      nodes: [
        { type: "text", props: { text: "Hello from R2", size: "lg" } },
        { type: "heading", props: { text: "What changed", level: 2 } },
        {
          type: "grid",
          props: { columns: 3 },
          children: [
            { type: "stat-card", props: { label: "Bucket", value: "visual-artifact-renderer", tone: "accent" } },
            { type: "metric", props: { label: "Worker", value: "live", delta: "deployed" } },
            { type: "stat-card", props: { label: "Interactive runtime + file APIs", value: "interactive runtime + file APIs" } },
          ],
        },
        {
          type: "status-grid",
          props: { dataKey: "checks", titleKey: "name", statusKey: "status", descriptionKey: "notes" },
        },
        {
          type: "alert",
          props: { title: "Quality gate", description: "Phase-0 acceptance still needs a resend test.", variant: "destructive" },
        },
        {
          type: "diff",
          props: {
            title: "Binding",
            language: "typescript",
            mode: "split",
            content: " export function spec(params) {\n-  const { projectPath, ...rest } = params\n+  const { projectPath, direction, ...rest } = params\n   return rest\n }",
          },
        },
        { type: "chart", props: { dataKey: "points", xKey: "race", yKey: "time_min", kind: "line", label: "Finish time" } },
        {
          type: "call-stack",
          props: {
            title: "Install path",
            rows: [
              { call: "main()", at: "install.mjs:10", excerpt: { code: "export function main() {\n  return plan()\n}", language: "javascript", startLine: 10 } },
              { call: "plan()", at: "install.mjs:20", note: "Builds the profile.", excerpt: { code: "export function plan() {\n  return {}\n}", language: "javascript", startLine: 20 } },
            ],
          },
        },
      ],
    })

    expect(spec.nodes.map((node) => node.type)).toEqual(["prose", "chapter"])
    const chapter = spec.nodes[1]
    expect(chapter.type).toBe("chapter")
    if (chapter.type !== "chapter") return
    expect(chapter.children?.map((child) => child.type)).toEqual(["figures", "prose", "ledger", "callout", "code", "trend", "walkthrough"])
    const diff = chapter.children?.[4]
    expect(diff?.type).toBe("code")
    if (diff?.type === "code") {
      expect(diff.props.before).toContain("const { projectPath, ...rest }")
      expect(diff.props.after).toContain("direction")
      expect(diff.props.diffMode).toBe("split")
    }
    const trace = chapter.children?.[6]
    expect(trace?.type).toBe("walkthrough")
    if (trace?.type === "walkthrough") {
      expect(trace.props.files).toHaveLength(2)
      expect(trace.props.steps[0].lines).toBe("10-12")
    }
  })

  test("turns a stepper with status into a checklist and keeps long flow text", () => {
    const spec = port({
      nodes: [
        {
          type: "stepper",
          props: {
            items: [
              { title: "Persist the result", description: "Write the deliverable before sandbox teardown.", status: "complete" },
              { title: "Resend from the ledger", description: "A retry reads the ledger and does not call the model again.", status: "current" },
            ],
          },
        },
        {
          type: "flow",
          props: {
            title: "Prioritized fixes",
            items: [
              { title: "Block empty completion", description: "A".repeat(180) },
              { title: "Split the stages", description: "Keep setup, execution, and delivery as separate checkpoints." },
            ],
          },
        },
      ],
    })
    expect(spec.nodes.map((node) => node.type)).toEqual(["checklist", "steps", "details"])
    const details = spec.nodes[2]
    expect(details.type).toBe("details")
  })
})
