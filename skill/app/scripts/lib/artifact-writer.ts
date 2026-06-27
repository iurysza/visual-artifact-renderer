import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import os from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))

function findSkillRoot(): string | null {
  let dir = resolve(__dirname, "..")
  for (let i = 0; i < 3; i++) {
    if (existsSync(resolve(dir, "SKILL.md"))) return dir
    dir = dirname(dir)
  }
  return null
}

const SKILL_ROOT = findSkillRoot()
const SKILL_ARTIFACTS_DIR = SKILL_ROOT ? resolve(SKILL_ROOT, "artifacts") : null

// --- Contract-driven spec validation ---
// Shared between the Pi extension and the OpenCode CLI wrapper.
// The renderer owns the contract; this module consumes it. No node types
// or limits are hardcoded here.

const KEBAB_CASE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const DEFAULT_BASE_URL = "http://localhost:9999/artifacts"
export const GLOBAL_ARTIFACTS_DIR = SKILL_ARTIFACTS_DIR ?? resolve(os.homedir(), ".pi", "artifacts")

export function resolveContractPath(): string {
  if (process.env.VISUALIZER_CONTRACT_PATH) {
    return resolve(process.env.VISUALIZER_CONTRACT_PATH, "artifact-contract.json")
  }
  if (SKILL_ROOT) {
    return resolve(SKILL_ROOT, "artifact-contract.json")
  }
  const fallback = resolve(os.homedir(), ".pi", "tools", "visualizer")
  return resolve(fallback, "artifact-contract.json")
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

export async function loadContract(): Promise<ArtifactContract> {
  if (contractCache) return contractCache
  let raw: string
  try {
    raw = await readFile(CONTRACT_PATH, "utf8")
  } catch (error) {
    throw new Error(
      `Could not load artifact contract from ${CONTRACT_PATH}. ` +
        `Generate it with "npx tsx app/scripts/export-contract.ts" in the skill directory ` +
        `or set VISUALIZER_CONTRACT_PATH to the directory containing artifact-contract.json. ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    )
  }
  contractCache = JSON.parse(raw) as ArtifactContract
  return contractCache
}

export function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

export function assertOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  return assertString(value, label)
}

export function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

export function validateNode(
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

  if (type === "image" && typeof props.src === "string" && /^file:\/\//i.test(props.src)) {
    throw new Error(
      `${path}.props.src must not use a file:// URL. ` +
        `Place sidecar image files next to the artifact JSON under skill/artifacts/<project>/ and use a relative path, ` +
        `or use an absolute HTTPS URL.`,
    )
  }

  if (type === "button" && typeof props.href === "string" && /^file:\/\//i.test(props.href)) {
    throw new Error(
      `${path}.props.href must not use a file:// URL. ` +
        `Use an app route or an absolute HTTPS URL.`,
    )
  }
}

export interface ValidatedSpec {
  slug: string
  title: string
  description?: string
  layout?: Record<string, unknown>
  data?: Record<string, unknown>
  nodes: unknown[]
}

export function validateSpec(spec: unknown, contract: ArtifactContract): ValidatedSpec {
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

export function sanitizeProjectName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
}

export function deriveProjectName(projectPath: string): string {
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

export function getTailscaleBaseUrl(): string | null {
  try {
    const output = execSync("tailscale status --json", {
      encoding: "utf8",
      timeout: 3000,
    })
    const status = JSON.parse(output) as { Self?: { DNSName?: string } }
    const dnsName = status.Self?.DNSName
    if (typeof dnsName === "string" && dnsName.length > 0) {
      const host = dnsName.endsWith(".") ? dnsName.slice(0, -1) : dnsName
      return `https://${host}/artifacts`
    }
  } catch {
    // Tailscale not installed or not running.
  }
  return null
}

export interface CreateArtifactResult {
  slug: string
  projectName: string
  projectPath: string
  filePath: string
  url: string
  localUrl: string
  tailnetUrl?: string
}

export async function createArtifact(
  spec: unknown,
  projectPath: string,
): Promise<CreateArtifactResult> {
  const contract = await loadContract()
  const validated = validateSpec(spec, contract)
  const resolvedProjectPath = resolve(projectPath)
  const projectName = deriveProjectName(resolvedProjectPath)
  const filePath = resolve(GLOBAL_ARTIFACTS_DIR, projectName, `${validated.slug}.json`)

  const localBaseUrl = DEFAULT_BASE_URL
  const tailscaleBaseUrl = getTailscaleBaseUrl()
  const preferredBaseUrl = process.env.VISUAL_ARTIFACT_BASE_URL ?? tailscaleBaseUrl ?? localBaseUrl

  const localUrl = `${localBaseUrl}/${projectName}/${validated.slug}/`
  const tailnetUrl = tailscaleBaseUrl ? `${tailscaleBaseUrl}/${projectName}/${validated.slug}/` : undefined
  const url = `${preferredBaseUrl}/${projectName}/${validated.slug}/`

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8")

  return {
    slug: validated.slug,
    projectName,
    projectPath: resolvedProjectPath,
    filePath,
    url,
    localUrl,
    tailnetUrl,
  }
}
