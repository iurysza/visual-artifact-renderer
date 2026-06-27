#!/usr/bin/env tsx
import { readFile } from "fs/promises"
import { resolve } from "path"

import { createArtifact, loadContract, DEFAULT_BASE_URL } from "./lib/artifact-writer"

function printHelp() {
  console.log(`vaz-create — validate and write a Visualizer artifact spec.

Usage:
  vaz-create [spec.json] [--project=./path]
  cat spec.json | vaz-create [--project=./path]

Self-discovery flags (no spec required):
  --help                Show this message.
  --schema              Print the full artifact-contract.json.
  --nodes               Print a compact reference of every node type and its props.
  --limits              Print global limits (data rows, string lengths, etc.).
  --examples            List available starter spec templates.
  --example=<name>      Print a starter spec template. Names: dashboard, architecture, report, gallery.

The spec format is a VisualArtifactSpec JSON object:
  {
    "slug": "kebab-case-slug",
    "title": "Artifact title",
    "description": "...",
    "data": { ... },
    "nodes": [ ... ]
  }

Read the contract for supported node types and props:
  vaz-create --nodes
`)
}

async function printSchema() {
  const contract = await loadContract()
  console.log(JSON.stringify(contract, null, 2))
}

async function printNodes() {
  const contract = await loadContract()
  const lines: string[] = []
  for (const type of contract.nodeTypes) {
    const def = contract.nodes[type]
    const props = Object.entries(def.props)
      .map(([key, typeStr]) => `${key}: ${typeStr}`)
      .join(", ")
    const limits = def.limits
      ? ` | limits: ${JSON.stringify(def.limits)}`
      : ""
    const dataFlag = def.requiresData ? " | requiresData" : ""
    lines.push(`- ${type}: ${props}${limits}${dataFlag}`)
  }
  console.log(lines.join("\n"))
}

async function printLimits() {
  const contract = await loadContract()
  console.log(JSON.stringify(contract.globalLimits, null, 2))
}

function printExampleList() {
  console.log("Available starter templates: dashboard, architecture, report, gallery")
}

function getExample(name: string): unknown {
  const examples: Record<string, unknown> = {
    dashboard: {
      slug: "example-dashboard",
      title: "Example Dashboard",
      description: "A starter dashboard with metrics and a chart.",
      data: {
        metrics: [
          { label: "Revenue", value: "$120K", delta: "+12%", trend: "up" },
          { label: "Churn", value: "2.4%", delta: "-0.3%", trend: "down" },
        ],
        series: [
          { month: "Jan", value: 10000 },
          { month: "Feb", value: 12000 },
          { month: "Mar", value: 14000 },
        ],
      },
      nodes: [
        {
          type: "grid",
          props: { columns: 2 },
          children: [
            {
              type: "stat-card",
              props: { label: "Revenue", value: "$120K", delta: "+12%", trend: "up" },
            },
            {
              type: "stat-card",
              props: { label: "Churn", value: "2.4%", delta: "-0.3%", trend: "down" },
            },
          ],
        },
        {
          type: "chart",
          props: { dataKey: "series", xKey: "month", yKey: "value", kind: "line", label: "Revenue" },
        },
      ],
    },
    architecture: {
      slug: "example-architecture",
      title: "Example Architecture",
      description: "A starter architecture overview.",
      data: {},
      nodes: [
        {
          type: "mermaid",
          props: {
            code: "graph LR\n  A[Client] --> B[API]\n  B --> C[Database]",
            title: "System topology",
          },
        },
        {
          type: "status-grid",
          props: {
            items: [
              { label: "API", status: "healthy", description: "Running" },
              { label: "DB", status: "healthy", description: "Running" },
            ],
          },
        },
      ],
    },
    report: {
      slug: "example-report",
      title: "Example Report",
      description: "A starter report with prose and a table.",
      data: {
        rows: [
          { name: "Alpha", status: "ok", owner: "Alice" },
          { name: "Beta", status: "at-risk", owner: "Bob" },
        ],
      },
      nodes: [
        {
          type: "prose",
          props: { content: "This is a starter report. Replace this prose with your narrative." },
        },
        {
          type: "data-table",
          props: { dataKey: "rows", columns: ["name", "status", "owner"] },
        },
      ],
    },
    gallery: {
      slug: "example-gallery",
      title: "Example Component Gallery",
      description: "A starter component gallery.",
      data: {},
      nodes: [
        { type: "heading", props: { level: 2, text: "Buttons" } },
        { type: "button", props: { label: "Primary" } },
        { type: "button", props: { label: "Secondary", variant: "secondary" } },
        { type: "badge", props: { label: "Status" } },
        { type: "separator", props: {} },
        { type: "alert", props: { title: "Heads up", description: "This is an alert." } },
      ],
    },
  }

  const example = examples[name]
  if (!example) {
    throw new Error(`Unknown example "${name}". Available: ${Object.keys(examples).join(", ")}`)
  }
  return example
}

async function printExample(name: string) {
  const example = getExample(name)
  console.log(JSON.stringify(example, null, 2))
}

async function createFromInput(args: string[]) {
  const projectPathFlag = args.find((arg) => arg.startsWith("--project="))
  const projectPath = projectPathFlag ? projectPathFlag.split("=")[1] : "."
  const fileArg = args.find((arg) => !arg.startsWith("--"))

  let raw: string
  if (fileArg) {
    raw = await readFile(resolve(fileArg), "utf8")
  } else {
    let chunks = ""
    process.stdin.setEncoding("utf8")
    for await (const chunk of process.stdin) {
      chunks += chunk
    }
    raw = chunks
  }

  if (!raw.trim()) {
    printHelp()
    process.exit(1)
  }

  const spec = JSON.parse(raw)
  const result = await createArtifact(spec, projectPath)

  console.log(`Created visual artifact ${result.slug} in project ${result.projectName}`)
  console.log(`File: ${result.filePath}`)
  console.log(`URL:  ${result.url}`)
  if (result.tailnetUrl && result.url !== result.tailnetUrl) {
    console.log(`Local: ${result.localUrl}`)
    console.log(`Tailnet: ${result.tailnetUrl}`)
  } else if (result.url !== result.localUrl) {
    console.log(`Local: ${result.localUrl}`)
  }

  // Emit the URL last so callers can pipe or capture it easily.
  console.log(result.url)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    printHelp()
    return
  }

  if (args.includes("--schema")) {
    await printSchema()
    return
  }

  if (args.includes("--nodes")) {
    await printNodes()
    return
  }

  if (args.includes("--limits")) {
    await printLimits()
    return
  }

  if (args.includes("--examples")) {
    printExampleList()
    return
  }

  const exampleFlag = args.find((arg) => arg.startsWith("--example="))
  if (exampleFlag) {
    const name = exampleFlag.split("=")[1]
    await printExample(name)
    return
  }

  await createFromInput(args)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
