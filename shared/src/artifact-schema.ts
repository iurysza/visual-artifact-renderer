import { z } from "zod"

// ---------------------------------------------------------------------------
// Resource envelope. These limits are enforced before recursive Zod parsing
// so hostile width/depth cannot exhaust the validator.
// ---------------------------------------------------------------------------

export const RAW_ARTIFACT_MAX_BYTES = 2 * 1024 * 1024
export const MAX_TOP_LEVEL_NODES = 30
export const MAX_DATASETS = 20
export const MAX_TOTAL_NODES = 100
export const MAX_NODE_DEPTH = 8
export const MAX_FILE_TREE_ITEMS = 500
export const MAX_FILE_TREE_DEPTH = 12
export const MAX_FILE_SOURCE_BYTES = 512 * 1024
export const MAX_AGGREGATE_FILE_SOURCE_BYTES = 1024 * 1024

export const ARTIFACT_SPEC_RESOURCE_LIMITS = {
  rawArtifactMaxBytes: RAW_ARTIFACT_MAX_BYTES,
  topLevelNodes: MAX_TOP_LEVEL_NODES,
  datasets: MAX_DATASETS,
  totalNodes: MAX_TOTAL_NODES,
  nodeDepth: MAX_NODE_DEPTH,
  fileTreeItems: MAX_FILE_TREE_ITEMS,
  fileTreeDepth: MAX_FILE_TREE_DEPTH,
  fileSourceBytes: MAX_FILE_SOURCE_BYTES,
  aggregateFileSourceBytes: MAX_AGGREGATE_FILE_SOURCE_BYTES,
} as const

export type ArtifactSpecResourceLimits = typeof ARTIFACT_SPEC_RESOURCE_LIMITS

// ---------------------------------------------------------------------------
// Shared error types
// ---------------------------------------------------------------------------

export class ArtifactValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArtifactValidationError"
  }
}

export class ArtifactSizeError extends ArtifactValidationError {
  constructor(message: string) {
    super(message)
    this.name = "ArtifactSizeError"
  }
}

export class ArtifactResourceError extends ArtifactValidationError {
  constructor(message: string) {
    super(message)
    this.name = "ArtifactResourceError"
  }
}

// ---------------------------------------------------------------------------
// Bounded raw JSON parser
// ---------------------------------------------------------------------------

declare const Buffer: { byteLength(value: string, encoding?: string): number } | undefined

function byteLength(value: string): number {
  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(value, "utf8")
  }
  return new TextEncoder().encode(value).length
}

/**
 * Parse a raw artifact JSON string after verifying it fits within the
 * configured byte limit. This is the single entry point for CLI file/stdin
 * reads and renderer fetch boundaries.
 */
export function parseRawArtifactJson(
  raw: string,
  maxBytes: number = RAW_ARTIFACT_MAX_BYTES,
): unknown {
  const length = byteLength(raw)
  if (length > maxBytes) {
    throw new ArtifactSizeError(
      `Artifact JSON is ${length} bytes, max allowed is ${maxBytes} bytes`,
    )
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ArtifactValidationError(`Invalid JSON: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Preflight: iterative shape/resource counting before recursive Zod parsing.
// ---------------------------------------------------------------------------

export interface ArtifactPreflightResult {
  topLevelNodes: number
  totalNodes: number
  maxDepth: number
  datasets: number
  fileTreeItems: number
  fileTreeMaxDepth: number
}

interface PreflightIssue {
  path: (string | number)[]
  message: string
}

function pushIssue(issues: PreflightIssue[], path: (string | number)[], message: string): void {
  issues.push({ path, message })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function countNodesIterative(
  nodes: unknown[],
  issues: PreflightIssue[],
  onFileTree: (items: unknown[], path: (string | number)[]) => void,
): Pick<ArtifactPreflightResult, "totalNodes" | "maxDepth"> {
  let totalNodes = 0
  let maxDepth = 0

  type StackItem = { node: unknown; depth: number; path: (string | number)[] }
  const stack: StackItem[] = []

  const enqueue = (
    children: unknown[],
    depth: number,
    path: (string | number)[],
  ): boolean => {
    const remaining = MAX_TOTAL_NODES - totalNodes - stack.length
    if (children.length > remaining) {
      pushIssue(issues, path, `Artifact cannot contain more than ${MAX_TOTAL_NODES} nodes`)
      return false
    }
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ node: children[i], depth, path: [...path, i] })
    }
    return true
  }

  if (!enqueue(nodes, 1, ["nodes"])) {
    return { totalNodes: MAX_TOTAL_NODES, maxDepth }
  }

  while (stack.length > 0) {
    const { node, depth, path } = stack.pop()!

    if (depth > MAX_NODE_DEPTH) {
      pushIssue(issues, path, `Nodes cannot nest deeper than ${MAX_NODE_DEPTH} levels`)
      break
    }

    totalNodes++
    if (depth > maxDepth) maxDepth = depth

    if (!isPlainObject(node)) continue

    if (node.type === "file-tree" && isPlainObject(node.props)) {
      const items = node.props.items
      if (Array.isArray(items)) onFileTree(items, [...path, "props", "items"])
    }

    const nextDepth = depth + 1
    if (Array.isArray(node.children) && !enqueue(node.children, nextDepth, [...path, "children"])) {
      return { totalNodes: MAX_TOTAL_NODES, maxDepth }
    }

    // Kept in preflight for hostile legacy input; the strict schema rejects it.
    if (
      isPlainObject(node.props) &&
      Array.isArray(node.props.children) &&
      !enqueue(node.props.children, nextDepth, [...path, "props", "children"])
    ) {
      return { totalNodes: MAX_TOTAL_NODES, maxDepth }
    }

    if (
      (node.type === "tabs" || node.type === "accordion") &&
      isPlainObject(node.props) &&
      Array.isArray(node.props.items)
    ) {
      if (node.props.items.length > MAX_TOTAL_NODES) {
        pushIssue(issues, [...path, "props", "items"], `Artifact cannot contain more than ${MAX_TOTAL_NODES} nodes`)
        return { totalNodes: MAX_TOTAL_NODES, maxDepth }
      }
      for (let i = node.props.items.length - 1; i >= 0; i--) {
        const item = node.props.items[i]
        if (
          isPlainObject(item) &&
          Array.isArray(item.nodes) &&
          !enqueue(item.nodes, nextDepth, [...path, "props", "items", i, "nodes"])
        ) {
          return { totalNodes: MAX_TOTAL_NODES, maxDepth }
        }
      }
    }
  }

  return { totalNodes, maxDepth }
}

function countFileTreeItemsIterative(
  items: unknown[],
  issues: PreflightIssue[],
  basePath: (string | number)[],
  maxItems: number,
): Pick<ArtifactPreflightResult, "fileTreeItems" | "fileTreeMaxDepth"> {
  let fileTreeItems = 0
  let fileTreeMaxDepth = 0

  type StackItem = { item: unknown; depth: number; path: (string | number)[] }
  const stack: StackItem[] = []

  const enqueue = (
    children: unknown[],
    depth: number,
    path: (string | number)[],
  ): boolean => {
    const remaining = maxItems - fileTreeItems - stack.length
    if (children.length > remaining) {
      pushIssue(
        issues,
        path,
        `Artifact cannot contain more than ${MAX_FILE_TREE_ITEMS} file-tree items`,
      )
      return false
    }
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ item: children[i], depth, path: [...path, i] })
    }
    return true
  }

  if (!enqueue(items, 1, basePath)) {
    return { fileTreeItems: maxItems, fileTreeMaxDepth }
  }

  while (stack.length > 0) {
    const { item, depth, path } = stack.pop()!

    if (depth > MAX_FILE_TREE_DEPTH) {
      pushIssue(issues, path, `file-tree cannot nest deeper than ${MAX_FILE_TREE_DEPTH} levels`)
      break
    }

    fileTreeItems++
    if (depth > fileTreeMaxDepth) fileTreeMaxDepth = depth

    if (!isPlainObject(item) || !Array.isArray(item.children)) continue
    if (!enqueue(item.children, depth + 1, [...path, "children"])) {
      return { fileTreeItems: maxItems, fileTreeMaxDepth }
    }
  }

  return { fileTreeItems, fileTreeMaxDepth }
}

/**
 * Fast iterative resource preflight. Rejects obvious abuse before the
 * recursive Zod schema is invoked.
 */
export function preflightArtifactSpec(value: unknown): {
  result: ArtifactPreflightResult
  issues: PreflightIssue[]
} {
  const issues: PreflightIssue[] = []
  const result: ArtifactPreflightResult = {
    topLevelNodes: 0,
    totalNodes: 0,
    maxDepth: 0,
    datasets: 0,
    fileTreeItems: 0,
    fileTreeMaxDepth: 0,
  }

  if (value === null || typeof value !== "object") {
    pushIssue(issues, [], "Artifact spec must be an object")
    return { result, issues }
  }

  const spec = value as Record<string, unknown>
  const nodes = spec.nodes
  if (!Array.isArray(nodes)) {
    pushIssue(issues, ["nodes"], "nodes must be an array")
    return { result, issues }
  }

  if (nodes.length > MAX_TOP_LEVEL_NODES) {
    pushIssue(
      issues,
      ["nodes"],
      `Artifact cannot have more than ${MAX_TOP_LEVEL_NODES} top-level nodes (got ${nodes.length})`,
    )
  }
  result.topLevelNodes = nodes.length

  const fileTrees: { items: unknown[]; path: (string | number)[] }[] = []

  if (nodes.length <= MAX_TOP_LEVEL_NODES) {
    const { totalNodes, maxDepth } = countNodesIterative(nodes, issues, (items, path) => {
      fileTrees.push({ items, path })
    })
    result.totalNodes = totalNodes
    result.maxDepth = maxDepth
  }

  if (spec.data && typeof spec.data === "object" && !Array.isArray(spec.data)) {
    const keys = Object.keys(spec.data)
    result.datasets = keys.length
    if (keys.length > MAX_DATASETS) {
      pushIssue(
        issues,
        ["data"],
        `Artifact cannot have more than ${MAX_DATASETS} datasets (got ${keys.length})`,
      )
    }
  }

  // file-tree item/depth limits are validated structurally by Zod, but
  // counting them here lets us fail early without recursing through the
  // discriminated union schema. The limit is artifact-wide across all
  // file-tree nodes, including nested ones.
  for (const { items, path } of fileTrees) {
    const remaining = MAX_FILE_TREE_ITEMS - result.fileTreeItems
    const counts = countFileTreeItemsIterative(items, issues, path, remaining)
    result.fileTreeItems += counts.fileTreeItems
    if (counts.fileTreeMaxDepth > result.fileTreeMaxDepth) {
      result.fileTreeMaxDepth = counts.fileTreeMaxDepth
    }
    if (issues.length > 0 && result.fileTreeItems >= MAX_FILE_TREE_ITEMS) break
  }

  return { result, issues }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const ARTIFACT_SLUG_MAX_LENGTH = 80

export const ArtifactSlugSchema = z
  .string()
  .min(1)
  .max(ARTIFACT_SLUG_MAX_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use kebab-case slugs")

const TextAlignSchema = z.enum(["left", "center", "right"])
const BadgeVariantSchema = z.enum([
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
])
const ButtonVariantSchema = z.enum([
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
])
const ButtonSizeSchema = z.enum(["default", "xs", "sm", "lg"])
const TrendSchema = z.enum(["up", "down", "neutral"])
const ChartKindSchema = z.enum(["line", "bar"])
const ToneSchema = z.enum(["default", "accent", "success", "warning", "danger"])
const GridColumnsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])

const metadataSchema = z
  .object({
    id: z.string().min(1).optional(),
  })
  .strict()
  .optional()

function leafSchema<T extends string, S extends z.ZodRawShape>(type: T, shape: S) {
  return z
    .object({
      type: z.literal(type),
      props: z.object(shape).strict(),
      metadata: metadataSchema,
    })
    .strict()
}

function optionalPropsSchema<T extends string, S extends z.ZodRawShape>(type: T, shape: S) {
  return z
    .object({
      type: z.literal(type),
      props: z.object(shape).strict().optional(),
      metadata: metadataSchema,
    })
    .strict()
}

function containerSchema<T extends string, S extends z.ZodRawShape, C extends z.ZodType<unknown>>(
  type: T,
  shape: S,
  children: C,
) {
  return z
    .object({
      type: z.literal(type),
      props: z.object(shape).strict().optional(),
      children,
      metadata: metadataSchema,
    })
    .strict()
}

export type ArtifactTone = z.infer<typeof ToneSchema>
export type ArtifactFlowItem = z.infer<typeof FlowItemSchema>
export type ArtifactColumn = z.infer<typeof ColumnSchema>

const FlowItemSchema = z
  .object({
    title: z.string().min(1),
    label: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
  })
  .strict()

type FileTreeItem = {
  name: string
  type?: "file" | "directory"
  children?: FileTreeItem[]
}

const GitStatusSchema = z
  .object({
    status: z.enum(["modified", "added", "deleted", "renamed", "untracked", "ignored"]),
    descendant: z.boolean().optional(),
  })
  .strict()

const FileTreeItemSchema: z.ZodType<FileTreeItem> = z.lazy(() =>
  z
    .object({
      name: z.string().min(1),
      type: z.enum(["file", "directory"]).optional(),
      children: z.array(FileTreeItemSchema).optional(),
      content: z.string().optional(),
      language: z.string().min(1).optional(),
      /** Repo-relative or absolute path; `create` reads it and inlines `content`. */
      src: z.string().min(1).optional(),
    })
    .strict(),
)

const ColumnSchema = z.union([
  z.string().min(1),
  z
    .object({
      key: z.string().min(1),
      label: z.string().min(1).optional(),
    })
    .strict(),
])

export type ArtifactNode =
  | { type: "definition-list"; props: { items: { term: string; description: string }[] }; metadata?: { id?: string } }
  | {
      type: "file-tree"
      props: {
        items: FileTreeItem[]
        flattenEmpty?: boolean
        searchable?: boolean
        gitStatus?: Record<string, { status: "modified" | "added" | "deleted" | "renamed" | "untracked" | "ignored"; descendant?: boolean }>
        density?: "compact" | "default" | "relaxed"
        iconSet?: "minimal" | "standard" | "complete"
        defaultExpanded?: boolean
      }
      metadata?: { id?: string }
    }
  | {
      type: "diff"
      props: {
        before?: string
        after?: string
        content?: string
        language?: string
        title?: string
        defaultOpen?: boolean
        mode?: "unified" | "split"
        showLineNumbers?: boolean
        indicators?: "bars" | "plus-minus" | "none"
        highlightInline?: boolean
        hunkSeparator?: "default" | "custom"
        caption?: string
      }
      metadata?: { id?: string }
    }
  | {
      type: "stepper"
      props: { items: { title: string; description?: string; status?: "complete" | "current" | "pending" }[] }
      metadata?: { id?: string }
    }
  | {
      type: "image"
      props: { src: string; alt: string; caption?: string; aspect?: "auto" | "square" | "video" | "wide"; zoom?: boolean }
      metadata?: { id?: string }
    }
  | {
      type: "alert"
      props: { title: string; description?: string; variant?: "default" | "destructive" }
      metadata?: { id?: string }
    }
  | {
      type: "pie-chart"
      props: { dataKey: string; categoryKey: string; valueKey: string }
      metadata?: { id?: string }
    }
  | {
      type: "donut-chart"
      props: { dataKey: string; categoryKey: string; valueKey: string }
      metadata?: { id?: string }
    }
  | {
      type: "area-chart"
      props: { dataKey: string; xKey?: string; yKey?: string; label?: string; color?: string }
      metadata?: { id?: string }
    }
  | {
      type: "radar-chart"
      props: { dataKey: string; subjectKey?: string; valueKey?: string; label?: string; color?: string }
      metadata?: { id?: string }
    }
  | {
      type: "scatter-chart"
      props: { dataKey: string; xKey?: string; yKey?: string; label?: string; color?: string }
      metadata?: { id?: string }
    }
  | {
      type: "heatmap"
      props: { dataKey: string; xKey?: string; yKey?: string; valueKey?: string; caption?: string }
      metadata?: { id?: string }
    }
  | {
      type: "log"
      props: { lines?: string[]; dataKey?: string }
      metadata?: { id?: string }
    }
  | {
      type: "prose"
      props: { content: string; tone?: "default" | "muted" }
      metadata?: { id?: string }
    }
  | {
      type: "heading"
      props: { text: string; level?: 1 | 2 | 3 | 4; align?: "left" | "center" | "right" }
      metadata?: { id?: string }
    }
  | {
      type: "text"
      props: { text: string; tone?: "default" | "muted"; size?: "sm" | "base" | "lg"; align?: "left" | "center" | "right" }
      metadata?: { id?: string }
    }
  | {
      type: "card"
      props?: { title?: string; description?: string; size?: "default" | "sm"; tone?: ArtifactTone }
      children?: ArtifactNode[]
      metadata?: { id?: string }
    }
  | {
      type: "metric"
      props: { label: string; value: string | number; delta?: string; trend?: "up" | "down" | "neutral" }
      metadata?: { id?: string }
    }
  | {
      type: "stat-card"
      props: { label: string; value: string | number; delta?: string; trend?: "up" | "down" | "neutral"; caption?: string; tone?: ArtifactTone }
      metadata?: { id?: string }
    }
  | {
      type: "badge"
      props: { label: string; variant?: z.infer<typeof BadgeVariantSchema> }
      metadata?: { id?: string }
    }
  | {
      type: "button"
      props: { label: string; href?: string; variant?: z.infer<typeof ButtonVariantSchema>; size?: z.infer<typeof ButtonSizeSchema> }
      metadata?: { id?: string }
    }
  | { type: "separator"; props?: Record<string, never>; metadata?: { id?: string } }
  | {
      type: "table"
      props: { dataKey: string; columns?: ArtifactColumn[]; caption?: string }
      metadata?: { id?: string }
    }
  | {
      type: "data-table"
      props: { dataKey: string; columns?: ArtifactColumn[]; caption?: string }
      metadata?: { id?: string }
    }
  | {
      type: "comparison-table"
      props: { dataKey: string; columns?: ArtifactColumn[]; statusKey?: string; caption?: string }
      metadata?: { id?: string }
    }
  | {
      type: "chart"
      props: { dataKey: string; xKey: string; yKey: string; kind?: "line" | "bar"; label?: string; color?: string }
      metadata?: { id?: string }
    }
  | {
      type: "mermaid"
      props: { code: string; caption: string; height?: number }
      metadata?: { id?: string }
    }
  | {
      type: "svg-diagram"
      props: { html: string; title?: string; caption?: string; height?: number }
      metadata?: { id?: string }
    }
  | {
      type: "flow"
      props: { title?: string; caption?: string; items: ArtifactFlowItem[] }
      metadata?: { id?: string }
    }
  | {
      type: "timeline"
      props: { dataKey: string; titleKey?: string; markerKey?: string; descriptionKey?: string; statusKey?: string; caption?: string }
      metadata?: { id?: string }
    }
  | {
      type: "code-block"
      props: { title?: string; language?: string; code: string; caption?: string }
      metadata?: { id?: string }
    }
  | {
      type: "status-grid"
      props: { dataKey: string; titleKey?: string; statusKey: string; descriptionKey?: string; metaKey?: string; columns?: 1 | 2 | 3 | 4; caption?: string }
      metadata?: { id?: string }
    }
  | {
      type: "grid"
      props?: { columns?: 1 | 2 | 3 | 4 }
      children?: ArtifactNode[]
      metadata?: { id?: string }
    }
  | {
      type: "section"
      props?: { title?: string; description?: string }
      children?: ArtifactNode[]
      metadata?: { id?: string }
    }
  | {
      type: "tabs"
      props: {
        defaultValue?: string
        items: { value: string; label: string; nodes: ArtifactNode[] }[]
      }
      metadata?: { id?: string }
    }
  | {
      type: "accordion"
      props: {
        items: { title: string; nodes: ArtifactNode[] }[]
      }
      metadata?: { id?: string }
    }

const DiagramHeightSchema = z.number().int().min(240).max(1600)

function hrefIsAllowed(href: string): boolean {
  // Browsers ignore leading/control whitespace when interpreting schemes.
  const normalized = href.trim().replace(/[\u0000-\u0020\u007f]/g, "")
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(normalized)?.[1]?.toLowerCase()
  return !scheme || ["http", "https", "mailto", "tel"].includes(scheme)
}

export const ArtifactNodeSchema: z.ZodType<ArtifactNode> = z.lazy(() => {
  const childNodes = z.array(ArtifactNodeSchema).optional()
  const requiredChildNodes = z.array(ArtifactNodeSchema).min(1)

  return z.discriminatedUnion("type", [
    leafSchema("definition-list", {
      items: z.array(
        z
          .object({
            term: z.string().min(1),
            description: z.string().min(1),
          })
          .strict(),
      ).min(1),
    }),
    leafSchema("file-tree", {
      items: z.array(FileTreeItemSchema).min(1),
      flattenEmpty: z.boolean().optional(),
      searchable: z.boolean().optional(),
      gitStatus: z.record(z.string().min(1), GitStatusSchema).optional(),
      density: z.enum(["compact", "default", "relaxed"]).optional(),
      iconSet: z.enum(["minimal", "standard", "complete"]).optional(),
      defaultExpanded: z.boolean().optional(),
    }),
    leafSchema("diff", {
      before: z.string().optional(),
      after: z.string().optional(),
      content: z.string().optional(),
      language: z.string().optional(),
      title: z.string().optional(),
      defaultOpen: z.boolean().optional(),
      mode: z.enum(["unified", "split"]).optional(),
      showLineNumbers: z.boolean().optional(),
      indicators: z.enum(["bars", "plus-minus", "none"]).optional(),
      highlightInline: z.boolean().optional(),
      hunkSeparator: z.enum(["default", "custom"]).optional(),
      caption: z.string().optional(),
    }),
    leafSchema("stepper", {
      items: z.array(
        z
          .object({
            title: z.string().min(1),
            description: z.string().optional(),
            status: z.enum(["complete", "current", "pending"]).optional(),
          })
          .strict(),
      ).min(1),
    }),
    leafSchema("image", {
      src: z.string(),
      alt: z.string(),
      caption: z.string().optional(),
      aspect: z.enum(["auto", "square", "video", "wide"]).optional(),
      zoom: z.boolean().optional(),
    }),
    leafSchema("alert", {
      title: z.string().min(1),
      description: z.string().optional(),
      variant: z.enum(["default", "destructive"]).optional(),
    }),
    leafSchema("pie-chart", {
      dataKey: z.string().min(1),
      categoryKey: z.string().min(1),
      valueKey: z.string().min(1),
    }),
    leafSchema("donut-chart", {
      dataKey: z.string().min(1),
      categoryKey: z.string().min(1),
      valueKey: z.string().min(1),
    }),
    leafSchema("area-chart", {
      dataKey: z.string().min(1),
      xKey: z.string().min(1).optional(),
      yKey: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
    }),
    leafSchema("radar-chart", {
      dataKey: z.string().min(1),
      subjectKey: z.string().min(1).optional(),
      valueKey: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
    }),
    leafSchema("scatter-chart", {
      dataKey: z.string().min(1),
      xKey: z.string().min(1).optional(),
      yKey: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
    }),
    leafSchema("heatmap", {
      dataKey: z.string().min(1),
      xKey: z.string().min(1).optional(),
      yKey: z.string().min(1).optional(),
      valueKey: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("log", {
      lines: z.array(z.string()).optional(),
      dataKey: z.string().min(1).optional(),
    }),
    leafSchema("prose", {
      content: z.string().min(1),
      tone: z.enum(["default", "muted"]).optional(),
    }),
    leafSchema("heading", {
      text: z.string().min(1),
      level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      align: TextAlignSchema.optional(),
    }),
    leafSchema("text", {
      text: z.string().min(1),
      tone: z.enum(["default", "muted"]).optional(),
      size: z.enum(["sm", "base", "lg"]).optional(),
      align: TextAlignSchema.optional(),
    }),
    containerSchema(
      "card",
      {
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        size: z.enum(["default", "sm"]).optional(),
        tone: ToneSchema.optional(),
      },
      childNodes,
    ),
    leafSchema("metric", {
      label: z.string().min(1),
      value: z.union([z.string(), z.number()]),
      delta: z.string().min(1).optional(),
      trend: TrendSchema.optional(),
    }),
    leafSchema("stat-card", {
      label: z.string().min(1),
      value: z.union([z.string(), z.number()]),
      delta: z.string().min(1).optional(),
      trend: TrendSchema.optional(),
      caption: z.string().min(1).optional(),
      tone: ToneSchema.optional(),
    }),
    leafSchema("badge", {
      label: z.string().min(1),
      variant: BadgeVariantSchema.optional(),
    }),
    leafSchema("button", {
      label: z.string().min(1),
      href: z.string().min(1).optional(),
      variant: ButtonVariantSchema.optional(),
      size: ButtonSizeSchema.optional(),
    }),
    optionalPropsSchema("separator", {}),
    leafSchema("table", {
      dataKey: z.string().min(1),
      columns: z.array(ColumnSchema).min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("data-table", {
      dataKey: z.string().min(1),
      columns: z.array(ColumnSchema).min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("comparison-table", {
      dataKey: z.string().min(1),
      columns: z.array(ColumnSchema).min(1).optional(),
      statusKey: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("chart", {
      dataKey: z.string().min(1),
      xKey: z.string().min(1),
      yKey: z.string().min(1),
      kind: ChartKindSchema.optional(),
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
    }),
    leafSchema("mermaid", {
      code: z.string().min(1),
      caption: z.string().min(1),
      height: DiagramHeightSchema.optional(),
    }),
    leafSchema("svg-diagram", {
      html: z.string().min(1),
      title: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
      height: DiagramHeightSchema.optional(),
    }),
    leafSchema("flow", {
      title: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
      items: z.array(FlowItemSchema).min(2),
    }),
    leafSchema("timeline", {
      dataKey: z.string().min(1),
      titleKey: z.string().min(1).optional(),
      markerKey: z.string().min(1).optional(),
      descriptionKey: z.string().min(1).optional(),
      statusKey: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("code-block", {
      title: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      code: z.string().min(1),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("status-grid", {
      dataKey: z.string().min(1),
      titleKey: z.string().min(1).optional(),
      statusKey: z.string().min(1),
      descriptionKey: z.string().min(1).optional(),
      metaKey: z.string().min(1).optional(),
      columns: GridColumnsSchema.optional(),
      caption: z.string().min(1).optional(),
    }),
    containerSchema(
      "grid",
      {
        columns: GridColumnsSchema.optional(),
      },
      childNodes,
    ),
    containerSchema(
      "section",
      {
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
      },
      childNodes,
    ),
    leafSchema("tabs", {
      defaultValue: z.string().min(1).optional(),
      items: z
        .array(
          z
            .object({
              value: z.string().min(1),
              label: z.string().min(1),
              nodes: requiredChildNodes,
            })
            .strict(),
        )
        .min(1),
    }),
    leafSchema("accordion", {
      items: z
        .array(
          z
            .object({
              title: z.string().min(1),
              nodes: requiredChildNodes,
            })
            .strict(),
        )
        .min(1),
    }),
  ])
})

const VisualArtifactSpecShapeSchema = z
  .object({
    slug: ArtifactSlugSchema,
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    createdAt: z.string().min(1).optional(),
    layout: z
      .object({
        type: z.enum(["default", "grid"]).optional(),
        columns: GridColumnsSchema.optional(),
      })
      .strict()
      .optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    nodes: z.array(ArtifactNodeSchema).min(1),
  })
  .strict()
  .superRefine((spec, context) => {
    const visit = (nodes: ArtifactNode[], path: (string | number)[]) => {
      nodes.forEach((node, index) => {
        const nodePath = [...path, index]

        if (node.type === "diff") {
          const { before, after, content } = node.props
          if (!content && (before === undefined || after === undefined)) {
            context.addIssue({
              code: "custom",
              message: "diff requires either props.content or both props.before and props.after",
              path: [...nodePath, "props"],
            })
          }
        }

        const props = "props" in node && node.props
          ? node.props as Record<string, unknown>
          : undefined
        const dataKey = typeof props?.dataKey === "string" ? props.dataKey : undefined
        if (dataKey) {
          const dataset = spec.data?.[dataKey]
          if (!Array.isArray(dataset)) {
            context.addIssue({
              code: "custom",
              message: `data.${dataKey} must be an array`,
              path: [...nodePath, "props", "dataKey"],
            })
          } else {
            dataset.forEach((row, rowIndex) => {
              if (!isPlainObject(row)) {
                context.addIssue({
                  code: "custom",
                  message: `data.${dataKey}[${rowIndex}] must be an object`,
                  path: ["data", dataKey, rowIndex],
                })
              }
            })
          }
        }

        if ((node.type === "card" || node.type === "grid" || node.type === "section") && node.children) {
          visit(node.children, [...nodePath, "children"])
        }

        if (node.type === "image" && /^file:\/\//i.test(node.props.src)) {
          context.addIssue({
            code: "custom",
            message: "image src must not use file:// URLs; use a relative sidecar path or an HTTPS URL",
            path: [...nodePath, "props", "src"],
          })
        }

        if (node.type === "button" && node.props.href && !hrefIsAllowed(node.props.href)) {
          context.addIssue({
            code: "custom",
            message: "button href uses a disallowed URL scheme; use http, https, mailto, tel, or a relative path",
            path: [...nodePath, "props", "href"],
          })
        }

        if (node.type === "tabs") {
          node.props.items.forEach((item, itemIndex) => {
            visit(item.nodes, [...nodePath, "props", "items", itemIndex, "nodes"])
          })
        }

        if (node.type === "accordion") {
          node.props.items.forEach((item, itemIndex) => {
            visit(item.nodes, [...nodePath, "props", "items", itemIndex, "nodes"])
          })
        }
      })
    }

    visit(spec.nodes, ["nodes"])
  })

export const VisualArtifactSpecSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    const { issues } = preflightArtifactSpec(value)
    for (const issue of issues) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: issue.path,
      })
    }
  })
  .pipe(VisualArtifactSpecShapeSchema)

export type VisualArtifactSpec = z.infer<typeof VisualArtifactSpecShapeSchema>

// ---------------------------------------------------------------------------
// Parsing entry points with preflight + Zod.
// ---------------------------------------------------------------------------

function formatPreflightPath(path: (string | number)[]): string {
  if (path.length === 0) return "spec"
  let result = String(path[0])
  for (const segment of path.slice(1)) {
    result += typeof segment === "number" ? `[${segment}]` : `.${segment}`
  }
  return result
}

function runPreflight(value: unknown): void {
  const { issues } = preflightArtifactSpec(value)
  if (issues.length > 0) {
    throw new ArtifactResourceError(
      issues.map((issue) => `${formatPreflightPath(issue.path)}: ${issue.message}`).join("; "),
    )
  }
}

/**
 * Validate and parse a VisualArtifactSpec value. Runs an iterative resource
 * preflight first, then the shared Zod schema. Throws
 * `ArtifactValidationError` (or subclass) on failure.
 */
export function parseVisualArtifactSpec(value: unknown): VisualArtifactSpec {
  runPreflight(value)
  const result = VisualArtifactSpecShapeSchema.safeParse(value)
  if (!result.success) {
    throw new ArtifactValidationError(result.error.message)
  }
  return result.data
}

export function safeParseVisualArtifactSpec(
  value: unknown,
):
  | { success: true; data: VisualArtifactSpec }
  | { success: false; error: z.ZodError<unknown> } {
  return VisualArtifactSpecSchema.safeParse(value)
}
