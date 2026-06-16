import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, dirname, resolve } from "node:path"
import os from "node:os"
import { StringEnum, Type } from "@earendil-works/pi-ai"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent"

// --- Contract-driven spec validation ---
// The renderer owns the contract; the extension consumes it. No node types
// or limits are hardcoded here.

const KEBAB_CASE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const DEFAULT_BASE_URL = "http://localhost:9999/artifacts"
const GLOBAL_ARTIFACTS_DIR = resolve(os.homedir(), ".pi", "artifacts")
const SKILL_PATH = resolve(os.homedir(), ".pi", "skills", "visual-artifact", "SKILL.md")
function resolveContractPath(): string {
  if (process.env.VISUALIZER_CONTRACT_PATH) {
    return resolve(process.env.VISUALIZER_CONTRACT_PATH, "artifact-contract.json")
  }
  const candidates = [
    resolve(os.homedir(), ".pi", "tools", "visualizer"),
    resolve(os.homedir(), "projects", "my-repos", "vibe-coded", "visualizer"),
  ]
  for (const candidate of candidates) {
    const contractPath = resolve(candidate, "artifact-contract.json")
    if (existsSync(contractPath)) {
      return contractPath
    }
  }
  return resolve(candidates[0], "artifact-contract.json")
}

const CONTRACT_PATH = resolveContractPath()

type NodeDef = {
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
}

type ArtifactContract = {
  version: string
  nodeTypes: readonly string[]
  nodes: Record<string, NodeDef>
  dataNodes: readonly string[]
  compositionGuidance: readonly string[]
  patternExamples: Record<string, { description: string; nodes: unknown[] }>
  globalLimits: {
    dataRowsMax: number
    dataStringMax: number
  }
}

let contractCache: ArtifactContract | null = null

async function loadContract(): Promise<ArtifactContract> {
  if (contractCache) return contractCache
  let raw: string
  try {
    raw = await readFile(CONTRACT_PATH, "utf8")
  } catch (error) {
    throw new Error(
      `Could not load artifact contract from ${CONTRACT_PATH}. ` +
        `Generate it with "npx tsx scripts/export-contract.ts" in the visualizer repo ` +
        `or set VISUALIZER_CONTRACT_PATH to the directory containing artifact-contract.json. ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    )
  }
  contractCache = JSON.parse(raw) as ArtifactContract
  return contractCache
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function assertOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  return assertString(value, label)
}

function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function validateNode(
  node: unknown,
  data: Record<string, unknown> | undefined,
  path: string,
  contract: ArtifactContract,
) {
  const obj = assertPlainObject(node, path)
  const type = assertString(obj.type, `${path}.type`)

  if (!contract.nodeTypes.includes(type)) {
    throw new Error(
      `${path}.type "${type}" is not a supported node type. ` +
        `Supported types: ${contract.nodeTypes.join(", ")}`,
    )
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
      throw new Error(
        `data.${dataKey} has ${dataset.length} rows, max allowed is ${contract.globalLimits.dataRowsMax}`,
      )
    }
    dataset.forEach((row, rowIndex) => {
      if (typeof row !== "object" || row === null) {
        throw new Error(`data.${dataKey}[${rowIndex}] must be an object`)
      }
      const rowObj = row as Record<string, unknown>
      Object.entries(rowObj).forEach(([key, value]) => {
        if (typeof value === "string" && value.length > contract.globalLimits.dataStringMax) {
          throw new Error(
            `data.${dataKey}[${rowIndex}].${key} is ${value.length} chars, max allowed is ${contract.globalLimits.dataStringMax}`,
          )
        }
      })
    })
  }

  if (limits.status) {
    const statusKey = props.statusKey as string | undefined
    const dataKey = props.dataKey as string | undefined
    const dataset = dataKey !== undefined ? data?.[dataKey] : undefined
    if (statusKey && Array.isArray(dataset)) {
      dataset.forEach((row, rowIndex) => {
        const rowObj = row as Record<string, unknown>
        const statusValue = rowObj[statusKey]
        if (typeof statusValue === "string" && statusValue.length > limits.status!) {
          throw new Error(
            `data.${dataKey}[${rowIndex}].${statusKey} is ${statusValue.length} chars, max allowed for status is ${limits.status}. ` +
              `Keep status values short (e.g. "ok", "pending"). Use description for longer text.`,
          )
        }
      })
    }
  }

  if (type === "flow" && Array.isArray(props.items)) {
    const items = props.items as unknown[]
    const maxItems = limits.items ?? 6
    if (items.length > maxItems) {
      throw new Error(`${path}.props.items has ${items.length} items, max allowed is ${maxItems}`)
    }
    items.forEach((item: unknown, index: number) => {
      const itemObj = assertPlainObject(item, `${path}.props.items[${index}]`)
      assertString(itemObj.title, `${path}.props.items[${index}].title`)
      const itemStatus = itemObj.status
      const maxStatus = limits.itemStatus ?? 16
      if (itemStatus && typeof itemStatus === "string" && itemStatus.length > maxStatus) {
        throw new Error(
          `${path}.props.items[${index}].status is ${itemStatus.length} chars, max allowed is ${maxStatus}`,
        )
      }
    })
  }

  if (nodeDef.children === "nodes" && Array.isArray(obj.children)) {
    const maxChildren = limits.children ?? 10
    if (obj.children.length > maxChildren) {
      throw new Error(`${path} children has ${obj.children.length} items, max allowed is ${maxChildren}`)
    }
    obj.children.forEach((child: unknown, index: number) =>
      validateNode(child, data, `${path}.children[${index}]`, contract),
    )
  }

  if (type === "tabs" && Array.isArray(props.items)) {
    const items = props.items as unknown[]
    const maxItems = limits.items ?? 5
    if (items.length > maxItems) {
      throw new Error(`${path}.props.items has ${items.length} items, max allowed is ${maxItems}`)
    }
    items.forEach((item: unknown, index: number) => {
      const itemObj = assertPlainObject(item, `${path}.props.items[${index}]`)
      assertString(itemObj.value, `${path}.props.items[${index}].value`)
      assertString(itemObj.label, `${path}.props.items[${index}].label`)
      const nodes = itemObj.nodes
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error(`${path}.props.items[${index}].nodes must be a non-empty array`)
      }
      nodes.forEach((child: unknown, childIndex: number) =>
        validateNode(child, data, `${path}.props.items[${index}].nodes[${childIndex}]`, contract),
      )
    })
  }

  if (type === "accordion" && Array.isArray(props.items)) {
    const items = props.items as unknown[]
    const maxItems = limits.items ?? 8
    if (items.length > maxItems) {
      throw new Error(`${path}.props.items has ${items.length} items, max allowed is ${maxItems}`)
    }
    items.forEach((item: unknown, index: number) => {
      const itemObj = assertPlainObject(item, `${path}.props.items[${index}]`)
      assertString(itemObj.title, `${path}.props.items[${index}].title`)
      const nodes = itemObj.nodes
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error(`${path}.props.items[${index}].nodes must be a non-empty array`)
      }
      nodes.forEach((child: unknown, childIndex: number) =>
        validateNode(child, data, `${path}.props.items[${index}].nodes[${childIndex}]`, contract),
      )
    })
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
}

interface ValidatedSpec {
  slug: string
  title: string
  description?: string
  layout?: Record<string, unknown>
  data?: Record<string, unknown>
  nodes: unknown[]
}

function validateSpec(spec: unknown, contract: ArtifactContract): ValidatedSpec {
  const obj = assertPlainObject(spec, "spec")

  const slug = assertString(obj.slug, "slug")
  if (!KEBAB_CASE_RE.test(slug)) {
    throw new Error("slug must be kebab-case")
  }

  const title = assertString(obj.title, "title")
  const description = assertOptionalString(obj.description, "description")

  let layout: Record<string, unknown> | undefined
  if (obj.layout !== undefined) {
    layout = assertPlainObject(obj.layout, "layout")
    if (layout.type !== undefined && layout.type !== "default" && layout.type !== "grid") {
      throw new Error("layout.type must be 'default' or 'grid'")
    }
    if (
      layout.columns !== undefined &&
      (typeof layout.columns !== "number" ||
        !Number.isInteger(layout.columns) ||
        layout.columns < 1 ||
        layout.columns > 4)
    ) {
      throw new Error("layout.columns must be an integer between 1 and 4")
    }
  }

  const data = obj.data === undefined ? undefined : assertPlainObject(obj.data, "data")

  if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) {
    throw new Error("nodes must be a non-empty array")
  }

  const nodes = obj.nodes as unknown[]
  nodes.forEach((node, index) => validateNode(node, data, `nodes[${index}]`, contract))

  return { slug, title, description, layout, data, nodes }
}

// --- Extension Implementation ---

function sanitizeProjectName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
}

function deriveProjectName(projectPath: string): string {
  try {
    const topLevel = execSync("git rev-parse --show-toplevel", {
      cwd: projectPath,
      encoding: "utf8",
      timeout: 3000,
    }).trim()
    return sanitizeProjectName(basename(topLevel))
  } catch {
    return sanitizeProjectName(basename(projectPath))
  }
}

const CreateVisualArtifactParams = Type.Object({
  slug: Type.String({ maxLength: 80, description: "kebab-case artifact slug. Example: revenue-dashboard" }),
  title: Type.String({ maxLength: 120, description: "Artifact title" }),
  description: Type.Optional(Type.String({ maxLength: 200, description: "Short artifact description" })),
  layout: Type.Optional(
    Type.Object({
      type: Type.Optional(StringEnum(["default", "grid"] as const)),
      columns: Type.Optional(Type.Number({ minimum: 1, maximum: 4 })),
    }),
  ),
  projectPath: Type.Optional(Type.String({ description: "Directory to derive the project name from. Defaults to caller's cwd." })),
  data: Type.Optional(
    Type.Record(Type.String(), Type.Any(), {
      maxProperties: 20,
      description: "Embedded datasets. Max 20 datasets.",
    }),
  ),
  nodes: Type.Array(Type.Any(), {
    minItems: 1,
    maxItems: 30,
    description: "ArtifactNode[]. Max 30 nodes. Use artifact-contract.json for supported node types/props.",
  }),
})

export default function visualArtifactExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", () => {
    return { skillPaths: [SKILL_PATH] }
  })

  pi.registerTool({
    name: "create_visual_artifact",
    label: "Create Visual Artifact",
    description: "Validate and save a visual artifact JSON spec to ~/.pi/artifacts/<project>/<slug>.json, then return its local URL.",
    promptSnippet: "Create a polished visual artifact from any Pi session; save it globally and return the URL.",
    promptGuidelines: [
      "For codebase visual artifacts (overviews, architecture diagrams, repo summaries), use the visual-artifact skill pipeline: run `vaz-pipeline <repoRoot>`, read the generated `visual-artifact-spec.json`, then call `create_visual_artifact`.",
      "For simple visual artifacts built directly from provided data or nodes, call `create_visual_artifact` directly.",
      "Before calling `create_visual_artifact`, read `artifact-contract.json` from the visualizer runtime and only use supported node types and props.",
      "Do not generate standalone HTML, JSX, React components, routes, imports, or CSS; emit a constrained JSON spec and call `create_visual_artifact`.",
      "Artifacts are saved globally under ~/.pi/artifacts/<project>/<slug>.json; the project name is derived from the caller's working directory.",
    ],
    parameters: CreateVisualArtifactParams,
    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
      _signal: AbortSignal,
      _onUpdate: (update: { type: string; text: string }) => void,
      ctx: { cwd?: string },
    ) {
      const contract = await loadContract()
      const spec = validateSpec(params, contract)
      const projectPath = params.projectPath ? resolve(String(params.projectPath)) : resolve(ctx.cwd ?? ".")
      const projectName = deriveProjectName(projectPath)
      const filePath = resolve(GLOBAL_ARTIFACTS_DIR, projectName, `${spec.slug}.json`)
      const url = `${process.env.VISUAL_ARTIFACT_BASE_URL ?? DEFAULT_BASE_URL}/${projectName}/${spec.slug}/`

      await withFileMutationQueue(filePath, async () => {
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, `${JSON.stringify(spec, null, 2)}\n`, "utf8")
      })

      return {
        content: [{ type: "text", text: `Created visual artifact ${spec.slug} in project ${projectName} at ${filePath}. Open ${url}` }],
        details: { slug: spec.slug, projectName, projectPath, path: filePath, url },
      }
    },
  })
}
