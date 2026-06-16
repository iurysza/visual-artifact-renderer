import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTRACT_PATH = path.resolve(__dirname, "..", "artifact-contract.json")

type ArtifactContract = {
  version: string
  nodeTypes: readonly string[]
  nodes: Record<string, {
    description: string
    props: Record<string, string>
    children: false | "nodes" | "items"
    data?: string
    requiresData?: boolean
    example: unknown
    limits?: {
      text?: number
      label?: number
      code?: number
      items?: number
      itemStatus?: number
      children?: number
      status?: number
    }
  }>
  dataNodes: readonly string[]
  compositionGuidance: readonly string[]
  patternExamples: Record<string, { description: string; nodes: unknown[] }>
  globalLimits: {
    dataRowsMax: number
    dataStringMax: number
  }
}

let contract: ArtifactContract

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function validateNode(node: unknown, data: Record<string, unknown> | undefined, path: string) {
  const obj = assertPlainObject(node, path)
  const type = assertString(obj.type, `${path}.type`)

  if (!contract.nodeTypes.includes(type)) {
    throw new Error(`${path}.type "${type}" is not a supported node type`)
  }

  const nodeDef = contract.nodes[type]
  const props = assertPlainObject(obj.props ?? {}, `${path}.props`)
  const limits = nodeDef.limits ?? {}

  if (nodeDef.requiresData) {
    const dataKey = assertString(props.dataKey, `${path}.props.dataKey`)
    const dataset = data?.[dataKey]
    if (!Array.isArray(dataset)) {
      throw new Error(`data.${dataKey} must be an array (required by ${path})`)
    }
    if (dataset.length > contract.globalLimits.dataRowsMax) {
      throw new Error(`data.${dataKey} has ${dataset.length} rows, max allowed is ${contract.globalLimits.dataRowsMax}`)
    }
  }

  if (limits.text && typeof props.text === "string" && props.text.length > limits.text) {
    throw new Error(`${path}.props.text is ${props.text.length} chars, max allowed is ${limits.text}`)
  }

  if (limits.label && typeof props.label === "string" && props.label.length > limits.label) {
    throw new Error(`${path}.props.label is ${props.label.length} chars, max allowed is ${limits.label}`)
  }

  if (limits.code && typeof props.code === "string" && props.code.length > limits.code) {
    throw new Error(`${path}.props.code is ${props.code.length} chars, max allowed is ${limits.code}`)
  }

  if (nodeDef.children === "nodes" && Array.isArray(obj.children)) {
    const maxChildren = limits.children ?? 10
    if (obj.children.length > maxChildren) {
      throw new Error(`${path} children has ${obj.children.length} items, max allowed is ${maxChildren}`)
    }
    obj.children.forEach((child: unknown, index: number) =>
      validateNode(child, data, `${path}.children[${index}]`),
    )
  }
}

function validateSpec(spec: unknown) {
  const obj = assertPlainObject(spec, "spec")
  assertString(obj.slug, "slug")
  assertString(obj.title, "title")
  if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) {
    throw new Error("nodes must be a non-empty array")
  }
  const data = obj.data === undefined ? undefined : assertPlainObject(obj.data, "data")
  ;(obj.nodes as unknown[]).forEach((node, index) => validateNode(node, data, `nodes[${index}]`))
}

function expectError(label: string, fn: () => void) {
  try {
    fn()
    throw new Error(`Expected error for: ${label}`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected error")) {
      throw error
    }
    console.log(`  ✓ ${label}: ${error instanceof Error ? error.message.split(". ")[0] : "error"}`)
  }
}

async function main() {
  contract = JSON.parse(await readFile(CONTRACT_PATH, "utf8")) as ArtifactContract

  console.log("Testing contract-based validation...")

  validateSpec({
    slug: "test",
    title: "Test",
    nodes: [{ type: "text", props: { text: "Hello" } }],
  })
  console.log("  ✓ minimal valid spec")

  expectError("unknown node type", () =>
    validateSpec({
      slug: "test",
      title: "Test",
      nodes: [{ type: "not-real", props: {} }],
    }),
  )

  expectError("text too long", () =>
    validateSpec({
      slug: "test",
      title: "Test",
      nodes: [{ type: "text", props: { text: "x".repeat(801) } }],
    }),
  )

  expectError("missing dataKey", () =>
    validateSpec({
      slug: "test",
      title: "Test",
      nodes: [{ type: "table", props: {} }],
    }),
  )

  expectError("too many data rows", () =>
    validateSpec({
      slug: "test",
      title: "Test",
      data: { rows: Array.from({ length: 21 }, (_, i) => ({ id: i })) },
      nodes: [{ type: "table", props: { dataKey: "rows" } }],
    }),
  )

  expectError("too many grid children", () =>
    validateSpec({
      slug: "test",
      title: "Test",
      nodes: [
        {
          type: "grid",
          props: { columns: 3 },
          children: Array.from({ length: 13 }, () => ({ type: "text", props: { text: "x" } })),
        },
      ],
    }),
  )

  console.log("All contract validation tests passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
