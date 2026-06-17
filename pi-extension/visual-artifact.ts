import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
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

  if (type === "image" && typeof props.src === "string" && /^file:\/\//i.test(props.src)) {
    throw new Error(
      `${path}.props.src must not use a file:// URL. ` +
        `Place sidecar image files next to the artifact JSON under ~/.pi/artifacts/<project>/ and use a relative path, ` +
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

function getTailscaleBaseUrl(): string | null {
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

// --- Visual Recap Command ---

interface ProjectIdentity {
  name?: string
  version?: string
  description?: string
  packageManager?: string
  keyDependencies?: string[]
  topLevelFiles?: string[]
}

interface VisualRecapData {
  projectName: string
  projectPath: string
  window: string
  windowLabel: string
  isGitRepo: boolean
  identity: ProjectIdentity
  recentCommits: string
  fileChanges: string
  contributors: string
  workingTreeStatus: string
  staleBranches: string
  recentlyChangedFiles: string[]
  todoComments: string
  errors: string[]
}

function parseRecapWindow(args: string): { since: string; label: string } {
  const trimmed = args.trim()
  const m = trimmed.match(/^(\d+)([wdm])$/i)
  if (m) {
    const n = parseInt(m[1], 10)
    const unit = m[2].toLowerCase()
    const label = `${n}${unit === "w" ? " week" : unit === "d" ? " day" : " month"}${n === 1 ? "" : "s"}`
    const since = `${n} ${label.split(" ").slice(1).join(" ")} ago`
    return { since, label }
  }
  return { since: "2 weeks ago", label: "2 weeks" }
}

async function execGit(
  pi: ExtensionAPI,
  cwd: string,
  args: string[],
  fallback = "",
): Promise<string> {
  try {
    const result = await pi.exec("git", args, { cwd, timeout: 10000 })
    if (result.killed) return fallback
    return result.code === 0 ? result.stdout.trim() : fallback
  } catch {
    return fallback
  }
}

async function readProjectIdentity(projectPath: string): Promise<ProjectIdentity> {
  const identity: ProjectIdentity = {}

  async function tryRead(file: string): Promise<string | undefined> {
    try {
      return await readFile(resolve(projectPath, file), "utf8")
    } catch {
      return undefined
    }
  }

  const readme = await tryRead("README.md")
  if (readme) {
    const firstLine = readme.split("\n").find((line) => line.trim().length > 0)
    identity.description = firstLine?.replace(/^#+\s*/, "").trim()
  }

  const packageJson = await tryRead("package.json")
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson) as Record<string, unknown>
      identity.name = typeof pkg.name === "string" ? pkg.name : identity.name
      identity.version = typeof pkg.version === "string" ? pkg.version : identity.version
      identity.description = typeof pkg.description === "string" ? pkg.description : identity.description
      identity.packageManager = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : identity.packageManager
      const deps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      } as Record<string, string>
      identity.keyDependencies = Object.keys(deps).slice(0, 12)
    } catch {
      // ignore
    }
  }

  const cargoToml = await tryRead("Cargo.toml")
  if (cargoToml) {
    identity.name = cargoToml.match(/^name\s*=\s*"([^"]+)"/)?.[1] ?? identity.name
    identity.version = cargoToml.match(/^version\s*=\s*"([^"]+)"/)?.[1] ?? identity.version
    identity.description = cargoToml.match(/^description\s*=\s*"([^"]+)"/)?.[1] ?? identity.description
  }

  const pyprojectToml = await tryRead("pyproject.toml")
  if (pyprojectToml) {
    const nameMatch = pyprojectToml.match(/^name\s*=\s*"([^"]+)"/m)
    const versionMatch = pyprojectToml.match(/^version\s*=\s*"([^"]+)"/m)
    const descMatch = pyprojectToml.match(/^description\s*=\s*"([^"]+)"/m)
    identity.name = nameMatch?.[1] ?? identity.name
    identity.version = versionMatch?.[1] ?? identity.version
    identity.description = descMatch?.[1] ?? identity.description
  }

  const goMod = await tryRead("go.mod")
  if (goMod) {
    identity.name = goMod.match(/^module\s+(\S+)/m)?.[1] ?? identity.name
  }

  return identity
}

async function gatherVisualRecap(
  pi: ExtensionAPI,
  projectPath: string,
  window: { since: string; label: string },
): Promise<VisualRecapData> {
  const errors: string[] = []
  const projectName = deriveProjectName(projectPath)

  const isGitRepo =
    (await execGit(pi, projectPath, ["rev-parse", "--is-inside-work-tree"])) === "true"

  const identity = await readProjectIdentity(projectPath)

  let topLevelFiles: string[] = []
  try {
    const entries = await readdir(projectPath, { withFileTypes: true })
    topLevelFiles = entries
      .filter((e) => e.isFile() || e.isDirectory())
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .slice(0, 40)
    identity.topLevelFiles = topLevelFiles
  } catch (err) {
    errors.push(`Could not list top-level files: ${err instanceof Error ? err.message : String(err)}`)
  }

  const recentCommits = isGitRepo
    ? await execGit(pi, projectPath, [
        "log",
        "--pretty=format:%h %ad %s",
        "--date=short",
        `--since=${window.since}`,
      ])
    : ""

  const fileChanges = isGitRepo
    ? await execGit(pi, projectPath, ["log", "--stat", `--since=${window.since}`])
    : ""

  const contributors = isGitRepo
    ? await execGit(pi, projectPath, ["shortlog", "-sn", `--since=${window.since}`])
    : ""

  const workingTreeStatus = isGitRepo
    ? await execGit(pi, projectPath, ["status", "--short"])
    : ""

  const staleBranches = isGitRepo
    ? await execGit(pi, projectPath, ["branch", "--no-merged"])
    : ""

  const recentlyChangedFiles = isGitRepo
    ? (
        await execGit(pi, projectPath, [
          "log",
          "--name-only",
          "--pretty=format:",
          `--since=${window.since}`,
        ])
      )
      .split("\n")
      .map((line) => line.trim())
      .filter((line, index, self) => line.length > 0 && self.indexOf(line) === index)
      .slice(0, 30)
    : []

  let todoComments = ""
  if (recentlyChangedFiles.length > 0 && process.env.PI_VISUAL_RECAP_TODOS !== "0") {
    try {
      const result = await pi.exec(
        "rg",
        ["-n", "TODO|FIXME|XXX|HACK", ...recentlyChangedFiles.slice(0, 20)],
        { cwd: projectPath, timeout: 10000 },
      )
      if (result.code === 0) {
        todoComments = result.stdout.trim()
      }
    } catch {
      // rg may not be available
    }
  }

  return {
    projectName,
    projectPath,
    window: window.since,
    windowLabel: window.label,
    isGitRepo,
    identity,
    recentCommits,
    fileChanges,
    contributors,
    workingTreeStatus,
    staleBranches,
    recentlyChangedFiles,
    todoComments,
    errors,
  }
}

function renderVisualRecapPrompt(data: VisualRecapData): string {
  const sections: string[] = []

  sections.push(
    `Generate a visual project recap artifact for "${data.projectName}" using create_visual_artifact.`,
  )
  sections.push(`Time window: ${data.windowLabel} (since ${data.window})`)
  sections.push("")

  if (data.errors.length > 0) {
    sections.push("## Data gathering errors")
    data.errors.forEach((e) => sections.push(`- ${e}`))
    sections.push("")
  }

  sections.push("## Project identity")
  sections.push(`- name: ${data.identity.name ?? "(unknown)"}`)
  sections.push(`- version: ${data.identity.version ?? "(unknown)"}`)
  sections.push(`- description: ${data.identity.description ?? "(unknown)"}`)
  if (data.identity.packageManager) {
    sections.push(`- package manager: ${data.identity.packageManager}`)
  }
  if (data.identity.keyDependencies && data.identity.keyDependencies.length > 0) {
    sections.push(`- key dependencies: ${data.identity.keyDependencies.join(", ")}`)
  }
  if (data.identity.topLevelFiles && data.identity.topLevelFiles.length > 0) {
    sections.push(`- top-level files: ${data.identity.topLevelFiles.join(", ")}`)
  }
  sections.push("")

  sections.push("## Recent commits")
  sections.push(data.recentCommits || "(none)")
  sections.push("")

  sections.push("## File-level changes")
  sections.push(data.fileChanges || "(none)")
  sections.push("")

  sections.push("## Contributors")
  sections.push(data.contributors || "(none)")
  sections.push("")

  sections.push("## Working tree status")
  sections.push(data.workingTreeStatus || "(clean)")
  sections.push("")

  sections.push("## Stale branches")
  sections.push(data.staleBranches || "(none)")
  sections.push("")

  sections.push("## Recently changed files")
  sections.push(data.recentlyChangedFiles.join("\n") || "(none)")
  sections.push("")

  sections.push("## TODO / FIXME comments in recently changed files")
  sections.push(data.todoComments || "(none)")
  sections.push("")

  sections.push("## Instructions")
  sections.push(
    "Read ~/.pi/tools/visualizer/artifact-contract.json, then build a VisualArtifactSpec JSON for this recap.",
  )
  sections.push(
    "Map sections to contract nodes: project identity (text/definition-list/card), architecture snapshot (mermaid), recent activity (timeline), decision log (accordion/table), state of things (stat-card/status-grid), mental model essentials (card/prose), cognitive debt hotspots (grid of cards with status), next steps (flow/timeline).",
  )
  sections.push(
    "For the recent activity timeline, use the commit date shown in the 'Recent commits' section as each row's marker. Use the ISO date (YYYY-MM-DD) from the log; the renderer will format it. Do not default markers to today's date.",
  )
  sections.push(
    "Use a warm editorial palette with muted blues and greens. Vary fonts from previous diagrams.",
  )
  sections.push(
    `Call create_visual_artifact with slug "${data.projectName}-visual-recap" (or "visual-recap" if that is not kebab-case), title "${data.projectName} visual recap", and the spec nodes.`,
  )
  sections.push("Return the artifact URL.")

  return sections.join("\n")
}

type AutocompleteItem = { value: string; label: string }

type DiffScope = {
  kind: "branch" | "commit" | "range" | "pr" | "uncommitted"
  ref: string
  description: string
  statCommand: string[]
  nameStatusCommand: string[]
  diffCommand: string[]
  showCommand?: string[]
}

function resolveDiffScope(args: string): DiffScope {
  const trimmed = args.trim()
  if (trimmed === "" || trimmed.toLowerCase() === "main") {
    return {
      kind: "branch",
      ref: "main",
      description: "working tree vs main",
      statCommand: ["git", "diff", "--stat", "main"],
      nameStatusCommand: ["git", "diff", "--name-status", "main", "--"],
      diffCommand: ["git", "diff", "main"],
    }
  }
  if (trimmed.toUpperCase() === "HEAD") {
    return {
      kind: "uncommitted",
      ref: "HEAD",
      description: "uncommitted changes (working tree + staged)",
      statCommand: ["git", "diff", "--stat", "HEAD"],
      nameStatusCommand: ["git", "diff", "--name-status", "HEAD", "--"],
      diffCommand: ["git", "diff", "HEAD"],
    }
  }
  if (/^#\d+$/.test(trimmed)) {
    const pr = trimmed.slice(1)
    return {
      kind: "pr",
      ref: pr,
      description: `PR #${pr}`,
      statCommand: ["gh", "pr", "view", pr, "--json", "files"],
      nameStatusCommand: ["gh", "pr", "view", pr, "--json", "files"],
      diffCommand: ["gh", "pr", "diff", pr],
    }
  }
  if (/^[0-9a-f]{7,40}\.\.[0-9a-f]{7,40}$/i.test(trimmed)) {
    return {
      kind: "range",
      ref: trimmed,
      description: `commit range ${trimmed}`,
      statCommand: ["git", "diff", "--stat", trimmed],
      nameStatusCommand: ["git", "diff", "--name-status", trimmed, "--"],
      diffCommand: ["git", "diff", trimmed],
    }
  }
  if (/^[0-9a-f]{7,40}$/i.test(trimmed)) {
    return {
      kind: "commit",
      ref: trimmed,
      description: `commit ${trimmed}`,
      statCommand: ["git", "diff", "--stat", `${trimmed}^..${trimmed}`],
      nameStatusCommand: ["git", "diff", "--name-status", `${trimmed}^..${trimmed}`, "--"],
      diffCommand: ["git", "show", trimmed],
      showCommand: ["git", "show", trimmed],
    }
  }
  return {
    kind: "branch",
    ref: trimmed,
    description: `working tree vs ${trimmed}`,
    statCommand: ["git", "diff", "--stat", trimmed],
    nameStatusCommand: ["git", "diff", "--name-status", trimmed, "--"],
    diffCommand: ["git", "diff", trimmed],
  }
}

function getBranchCompletions(prefix: string): AutocompleteItem[] | null {
  try {
    const output = execSync("git branch -a --format='%(refname:short)'", {
      encoding: "utf8",
      timeout: 2000,
    })
    const branches = output
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean)
    const seen = new Set<string>()
    const items: AutocompleteItem[] = []
    const add = (value: string, label: string) => {
      if (seen.has(value)) return
      seen.add(value)
      items.push({ value, label })
    }
    add("HEAD", "HEAD (uncommitted changes)")
    add("main", "main")
    branches.forEach((b) => add(b, b))
    const filtered = items.filter((i) => i.value.startsWith(prefix))
    return filtered.length > 0 ? filtered : null
  } catch {
    return null
  }
}

function buildDiffReviewPrompt(scope: DiffScope, cwd: string): string {
  const commandList = [
    `stat overview: ${scope.statCommand.join(" ")}`,
    `name/status: ${scope.nameStatusCommand.join(" ")}`,
    `full diff: ${scope.diffCommand.join(" ")}`,
  ]
  if (scope.showCommand) {
    commandList.push(`commit show: ${scope.showCommand.join(" ")}`)
  }
  if (scope.kind === "uncommitted") {
    commandList.push("also run: git diff --staged")
  }

  return `Run a visual diff review for this repo.

Scope: ${scope.description}
Working directory: ${cwd}

Use the visual-artifact skill (direct artifact route). Read references/design-guidelines.md and references/content-types/_index.md before building. For each section, use the matching content-type guide: architecture-diagrams.md for section 3/5, dashboards.md for section 2, data-organization.md for tables and comparisons, timelines.md if any roadmap or sequence appears.

Data gathering — run these commands to understand the full scope:
${commandList.map((c) => `- ${c}`).join("\n")}

Also:
- Compare line counts for changed files.
- Detect new public API surface by grepping added lines for exported symbols (export/function/class/interface for TS/JS; adapt to the project's language).
- Inventory new features: actions, keybindings, config fields, event types.
- Read all changed files in full, including surrounding code paths needed to validate behavior.
- Check whether CHANGELOG.md has an entry for these changes.
- Check whether README.md or docs/*.md need updates.
- Reconstruct decision rationale from the current conversation, progress docs (~/.agent/memory/<project>/progress.md, ~/.pi/agent/memory/<project>/progress.md), plan files, commit messages, or PR descriptions.

Verification checkpoint — before generating the artifact, build an internal fact sheet of every claim you will present (counts, names, behavior descriptions). Cite the source command or file:line for each. Mark uncertain claims as uncertain. Keep the fact sheet internal; do not show it unless I ask.

Build a visual artifact via create_visual_artifact with these sections:
1. Executive summary — lead with the intuition (why these changes exist, what problem they solve), then factual scope.
2. KPI dashboard — lines added/removed, files changed, new modules, test counts. Include CHANGELOG updated? and docs need updates? indicators.
3. Module architecture — current file structure and a Mermaid dependency graph.
4. Major feature comparisons — before/after panels for each significant area.
5. Flow diagrams — new lifecycle/pipeline/interaction patterns as Mermaid diagrams.
6. File map — full tree with new/modified/deleted indicators.
7. Test coverage — before/after test file counts and coverage notes.
8. Code review — Good/Bad/Ugly/Questions cards, each referencing files and line ranges.
9. Decision log — decision, rationale, alternatives considered, confidence (high/medium/low).
10. Re-entry context — invariants, non-obvious coupling, gotchas, follow-up work.

Aesthetic: GitHub-diff-inspired (red for removed/before, green for added/after, yellow for modified, blue for neutral context), but vary fonts and palette from recent artifacts. No CSS details; the renderer handles styling.

If surf CLI is available, optionally generate a hero illustration; otherwise skip.

If there are no changes, tell me so and do not create an artifact.

Use a slug like "<project>-diff-review-<ref>" (e.g., "visualizer-diff-review-main"). Call create_visual_artifact and return the URL.`
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

  pi.registerCommand("visual-diff", {
    description: "Generate a visual diff review as a visual artifact. Args: branch, commit, range, #PR, HEAD, or empty (defaults to main).",
    argumentHint: "[branch|commit|range|#PR|HEAD]",
    getArgumentCompletions: getBranchCompletions,
    handler: async (args, ctx) => {
      try {
        execSync("git rev-parse --git-dir", { cwd: ctx.cwd, encoding: "utf8", timeout: 2000 })
      } catch {
        ctx.ui.notify("visual-diff must be run inside a git repository", "error")
        return
      }

      const scope = resolveDiffScope(args)
      if (ctx.mode === "tui") {
        ctx.ui.notify(`Generating visual diff review for ${scope.description}...`, "info")
      }
      await pi.sendUserMessage(buildDiffReviewPrompt(scope, ctx.cwd))
    },
  })

  pi.registerCommand("visual-recap", {
    description: "Generate a visual project recap — current state, recent decisions, and cognitive debt hotspots",
    argumentHint: "[time-window-or-context]",
    handler: async (args, ctx) => {
      const window = parseRecapWindow(args)
      if (ctx.mode === "tui") {
        ctx.ui.notify(`Gathering visual recap data for the last ${window.label}...`, "info")
      }
      const data = await gatherVisualRecap(pi, ctx.cwd, window)
      await pi.sendUserMessage(renderVisualRecapPrompt(data))
    },
  })

  pi.registerTool({
    name: "create_visual_artifact",
    label: "Create Visual Artifact",
    description: "Validate and save a visual artifact JSON spec to ~/.pi/artifacts/<project>/<slug>.json, then return its URL (local tailnet URL when Tailscale is available).",
    promptSnippet: "Create a polished visual artifact from any Pi session; save it globally and return the URL.",
    promptGuidelines: [
      "For codebase visual artifacts (overviews, architecture diagrams, repo summaries), use the visual-artifact skill pipeline: run `vaz-pipeline <repoRoot>`, read the generated `visual-artifact-spec.json`, then call `create_visual_artifact`.",
      "For simple visual artifacts built directly from provided data or nodes, call `create_visual_artifact` directly.",
      "Before calling `create_visual_artifact`, read `artifact-contract.json` from the visualizer runtime and only use supported node types and props.",
      "Do not generate standalone HTML, JSX, React components, routes, imports, or CSS; emit a constrained JSON spec and call `create_visual_artifact`.",
      "Artifacts are saved globally under ~/.pi/artifacts/<project>/<slug>.json; the project name is derived from the caller's working directory.",
      "When Tailscale is running, the tool result includes a tailnetUrl; prefer it for sharing outside the local machine.",
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

      const localBaseUrl = DEFAULT_BASE_URL
      const tailscaleBaseUrl = getTailscaleBaseUrl()
      const preferredBaseUrl = process.env.VISUAL_ARTIFACT_BASE_URL ?? tailscaleBaseUrl ?? localBaseUrl

      const localUrl = `${localBaseUrl}/${projectName}/${spec.slug}/`
      const tailnetUrl = tailscaleBaseUrl ? `${tailscaleBaseUrl}/${projectName}/${spec.slug}/` : undefined
      const url = `${preferredBaseUrl}/${projectName}/${spec.slug}/`

      await withFileMutationQueue(filePath, async () => {
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, `${JSON.stringify(spec, null, 2)}\n`, "utf8")
      })

      let text = `Created visual artifact ${spec.slug} in project ${projectName} at ${filePath}. Open ${url}`
      if (tailnetUrl && url !== tailnetUrl) {
        text += ` (tailnet: ${tailnetUrl})`
      }

      return {
        content: [{ type: "text", text }],
        details: { slug: spec.slug, projectName, projectPath, path: filePath, url, localUrl, tailnetUrl },
      }
    },
  })
}
