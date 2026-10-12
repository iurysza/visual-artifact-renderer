// Rewrites pre-contract-3 artifact specs onto the contract 3 node set.
// Removed types are mapped to the nearest surviving node. String caps are the
// schema's; when a cap would hide text, the full source stays in a details table
// or a following prose node.

import { normalizeCallStackRows } from "@agents/visual-artifact-annotations/contract"

export const REMOVED_NODE_TYPES = [
  "section",
  "heading",
  "separator",
  "text",
  "card",
  "grid",
  "tabs",
  "stat-card",
  "metric",
  "change-stats",
  "pie-chart",
  "donut-chart",
  "status-grid",
  "definition-list",
  "badge",
  "data-table",
  "comparison-table",
  "flow",
  "stepper",
  "box-diagram",
  "sequence-diagram",
  "chart",
  "area-chart",
  "scatter-chart",
  "radar-chart",
  "heatmap",
  "alert",
  "accordion",
  "code-block",
  "diff",
  "log",
  "call-stack",
  "quotes",
  "button",
] as const

const REMOVED = new Set<string>(REMOVED_NODE_TYPES)

const CONTAINER_TYPES = new Set([
  "chapter",
  "columns",
  "details",
  "claim-tree",
  "claim",
  "state-machine",
  "mockup",
])

const COLUMNS_CHILD_TYPES = new Set(["prose", "figures", "checklist", "links", "quote"])

const PROGRESS_STATES = {
  complete: "done",
  completed: "done",
  done: "done",
  success: "done",
  succeeded: "done",
  current: "doing",
  doing: "doing",
  "in-progress": "doing",
  "in progress": "doing",
  active: "doing",
  started: "doing",
  pending: "todo",
  todo: "todo",
  next: "todo",
  planned: "todo",
  "not-started": "todo",
  blocked: "blocked",
  fail: "blocked",
  failed: "blocked",
  error: "blocked",
  dropped: "dropped",
  skipped: "dropped",
  cancelled: "dropped",
  canceled: "dropped",
  "wont-do": "dropped",
} as const

type ChecklistState = (typeof PROGRESS_STATES)[keyof typeof PROGRESS_STATES]
type LedgerSignal = "risk" | "wait" | "new" | "done" | "none"

export interface PortReport {
  replacements: Record<string, number>
  warnings: string[]
}

interface PortNode {
  type: string
  props?: Record<string, unknown>
  children?: PortNode[]
  metadata?: { id: string }
}

interface PortContext {
  data: Record<string, unknown>
  counts: Map<string, number>
  warnings: string[]
}

interface Clip {
  text: string
  clipped: boolean
}

export function portArtifactSpec(input: unknown): { spec: Record<string, unknown>; report: PortReport } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Artifact spec must be an object")
  }
  const source = input as Record<string, unknown>
  const data = source.data && typeof source.data === "object" && !Array.isArray(source.data)
    ? { ...(source.data as Record<string, unknown>) }
    : {}
  const ctx: PortContext = { data, counts: new Map(), warnings: [] }
  const nodes = transformList(asNodes(source.nodes), ctx)
  if (nodes.length === 0) {
    ctx.warnings.push("spec produced no nodes; inserted a placeholder prose node")
    nodes.push(prose("This artifact had no content that could be ported."))
  }

  const spec: Record<string, unknown> = {}
  if (typeof source.slug === "string") spec.slug = source.slug
  if (typeof source.title === "string") spec.title = source.title
  if (typeof source.description === "string" && source.description.trim()) spec.description = source.description
  if (typeof source.createdAt === "string" && source.createdAt.trim()) spec.createdAt = source.createdAt
  if (typeof source.artifactType === "string") spec.artifactType = source.artifactType
  if (Array.isArray(source.topics)) {
    const topics = source.topics.filter((topic): topic is string => typeof topic === "string" && topic.trim().length > 0)
    if (topics.length) spec.topics = topics
  }
  const layout = sanitizeLayout(source.layout)
  if (layout) spec.layout = layout
  if (Object.keys(ctx.data).length) spec.data = ctx.data
  spec.nodes = nodes

  return {
    spec,
    report: {
      replacements: Object.fromEntries([...ctx.counts.entries()].sort(([a], [b]) => a.localeCompare(b))),
      warnings: ctx.warnings,
    },
  }
}

export function specUsesRemovedNodes(input: unknown): boolean {
  let found = false
  const visit = (value: unknown): void => {
    if (found || !value || typeof value !== "object") return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const node = value as Record<string, unknown>
    if (typeof node.type === "string" && REMOVED.has(node.type)) {
      found = true
      return
    }
    if (Array.isArray(node.nodes)) visit(node.nodes)
    if (Array.isArray(node.children)) visit(node.children)
    if (node.props && typeof node.props === "object") visit(node.props)
  }
  visit(input)
  return found
}

function transformList(nodes: PortNode[], ctx: PortContext): PortNode[] {
  const out: PortNode[] = []
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (isStat(node)) {
      const run = [node]
      while (index + 1 < nodes.length && isStat(nodes[index + 1])) run.push(nodes[++index])
      out.push(...figuresFromStats(run, ctx))
      continue
    }
    if (isTextCard(node) && index + 1 < nodes.length && isTextCard(nodes[index + 1])) {
      const run = [node]
      while (index + 1 < nodes.length && isTextCard(nodes[index + 1])) run.push(nodes[++index])
      out.push(...columnsFromCards(run, ctx))
      continue
    }
    out.push(...transformNode(node, ctx))
  }
  return groupHeadings(out)
}

function transformNode(node: PortNode, ctx: PortContext): PortNode[] {
  if (!REMOVED.has(node.type)) {
    const next = passthrough(node, ctx)
    if (next.type === "columns" && next.children?.some((child) => !COLUMNS_CHILD_TYPES.has(child.type))) {
      ctx.warnings.push("columns held a non-text child; unwrapped it")
      return next.children ?? []
    }
    return [next]
  }
  if (!isStat(node)) ctx.counts.set(node.type, (ctx.counts.get(node.type) ?? 0) + 1)
  switch (node.type) {
    case "section":
      return [chapterNode(stringProp(node, "title") || "Section", stringProp(node, "description"), childNodes(node), ctx)]
    case "heading":
      return [{ type: "heading", props: { text: stringProp(node, "text") || "Section" } }]
    case "separator":
      return []
    case "text":
      return textToProse(node)
    case "card":
      return portCard(node, ctx)
    case "grid":
      return portGrid(node, ctx)
    case "tabs":
      return portTabs(node, ctx)
    case "stat-card":
    case "metric":
    case "change-stats":
      return figuresFromStats([node], ctx)
    case "pie-chart":
    case "donut-chart":
      return portSlices(node, ctx, true)
    case "radar-chart":
    case "heatmap":
      return portSlices(node, ctx, false)
    case "status-grid":
      return portStatusGrid(node, ctx)
    case "definition-list":
      return portDefinitionList(node, ctx)
    case "badge":
      return portBadge(node)
    case "data-table":
    case "comparison-table":
      return [portTable(node)]
    case "flow":
    case "stepper":
      return portProcess(node, ctx)
    case "box-diagram":
      return portBox(node, ctx)
    case "sequence-diagram":
      return portSequence(node, ctx)
    case "chart":
    case "area-chart":
    case "scatter-chart":
      return [portTrend(node)]
    case "alert":
      return portAlert(node)
    case "accordion":
      return portAccordion(node, ctx)
    case "code-block":
    case "log":
      return portCodeBlock(node)
    case "diff":
      return portDiff(node)
    case "call-stack":
      return portCallStack(node, ctx)
    case "quotes":
      return portQuotes(node)
    case "button":
      return portButton(node)
    default:
      ctx.warnings.push(`no mapping for ${node.type}`)
      return []
  }
}

function passthrough(node: PortNode, ctx: PortContext): PortNode {
  const children = CONTAINER_TYPES.has(node.type) ? transformList(childNodes(node), ctx) : undefined
  const props = node.props ? { ...node.props } : undefined
  if (node.type === "mermaid" && props && typeof props.caption !== "string") props.caption = "Diagram"
  return emit(node.type, props, children?.length ? children : undefined, node.metadata)
}

function portGrid(node: PortNode, ctx: PortContext): PortNode[] {
  const children = childNodes(node)
  if (children.length === 0) return []
  if (children.every(isStat)) return figuresFromStats(children, ctx)
  if (children.every(isTextCard)) return columnsFromCards(children, ctx)
  return transformList(children, ctx)
}

function portCard(node: PortNode, ctx: PortContext): PortNode[] {
  if (!isTextCard(node)) {
    return [chapterNode(stringProp(node, "title") || "Note", stringProp(node, "description"), childNodes(node), ctx)]
  }
  const proseNode = cardToProse(node)
  return proseNode ? [proseNode] : []
}

function portTabs(node: PortNode, ctx: PortContext): PortNode[] {
  const items = Array.isArray(node.props?.items) ? node.props.items : childNodes(node)
  const chapters: PortNode[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    if (typeof record.type === "string") {
      chapters.push(...transformNode(record as unknown as PortNode, ctx))
      continue
    }
    const title = stringOf(record.title) || stringOf(record.label) || stringOf(record.summary) || "Tab"
    const kids = asNodes(record.nodes ?? record.children)
    chapters.push(chapterNode(title, stringOf(record.description), kids, ctx))
  }
  return chapters
}

function portStatusGrid(node: PortNode, ctx: PortContext): PortNode[] {
  const dataKey = stringProp(node, "dataKey")
  const rows = dataKey ? datasetRows(ctx.data, dataKey) : null
  if (!dataKey || !rows) {
    ctx.warnings.push(`status-grid missing dataset ${dataKey ?? ""}`.trim())
    return [prose(stringProp(node, "caption") || "Status list was missing its dataset.")]
  }
  const titleKey = stringProp(node, "titleKey") || "title"
  const bodyKey = stringProp(node, "descriptionKey") || firstFilledKey(rows, ["description", "notes", "detail", "body", "summary"]) || titleKey
  const metaKey = stringProp(node, "metaKey")
  const statusKey = stringProp(node, "statusKey")
  const groups = new Map<string, number>()
  for (const row of rows) {
    const name = statusKey ? (stringOf(row[statusKey]) || "Status") : "Status"
    groups.set(name, (groups.get(name) ?? 0) + 1)
  }
  const fitsLedger = groups.size <= 4 && groups.size > 0 && [...groups.values()].every((count) => count <= 12)
  if (fitsLedger && statusKey && [...groups.keys()].every((name) => name.length > 0 && name.length <= 40)) {
    const signals: Record<string, LedgerSignal> = {}
    for (const name of groups.keys()) signals[name] = ledgerSignal(name)
    const props: Record<string, unknown> = {
      dataKey,
      titleKey,
      bodyKey,
      groupKey: statusKey,
      signals,
      groupOrder: [...groups.keys()],
    }
    const caption = stringProp(node, "caption")
    if (caption) props.caption = caption
    if (metaKey && metaKey !== titleKey && metaKey !== bodyKey) props.metaKey = metaKey
    return [emit("ledger", props)]
  }

  const literalGroups: Array<{ label: string; signal: LedgerSignal; rows: Array<Record<string, unknown>> }> = []
  let clipped = false
  for (const [label, ] of groups) {
    const matching = rows.filter((row) => (statusKey ? (stringOf(row[statusKey]) || "Status") : "Status") === label)
    const built = matching.map((row) => {
      const title = clip(stringOf(row[titleKey]) || "Item", 60, true)
      let bodyText = stringOf(row[bodyKey])
      let meta = metaKey ? stringOf(row[metaKey]) : ""
      if (meta.length > 40) {
        bodyText = bodyText ? `${bodyText} (${meta})` : meta
        meta = ""
      }
      const body = clip(bodyText || "—", 280, false)
      if (title.clipped || body.clipped) clipped = true
      const ledgerRow: Record<string, unknown> = { title: title.text, body: body.text || "—" }
      if (meta) ledgerRow.meta = meta
      return ledgerRow
    })
    const pieces = chunk(built, 12)
    pieces.forEach((piece, pieceIndex) => {
      const rawLabel = pieceIndex === 0 ? label : `${label} (${pieceIndex + 1})`
      const clippedLabel = clip(rawLabel, 40, true)
      if (clippedLabel.clipped) clipped = true
      literalGroups.push({ label: clippedLabel.text, signal: ledgerSignal(label), rows: piece })
    })
  }
  if (literalGroups.length === 0) return [prose(stringProp(node, "caption") || "Status list was empty.")]
  const ledgers = chunk(literalGroups, 4).map((groupChunk, index) => {
    const props: Record<string, unknown> = { groups: groupChunk }
    const caption = stringProp(node, "caption")
    if (index === 0 && caption) props.caption = caption
    return emit("ledger", props)
  })
  if (!clipped) return ledgers
  return [...ledgers, detailsNode("Full list", [portTable(node)])]
}

function portDefinitionList(node: PortNode, ctx: PortContext): PortNode[] {
  const items = Array.isArray(node.props?.items) ? node.props.items : []
  const rows: Array<Record<string, unknown>> = []
  const overflow: string[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const term = stringOf(record.term) || stringOf(record.title) || "Term"
    const description = stringOf(record.description) || stringOf(record.body) || "—"
    const title = clip(term, 60, true)
    const body = clip(description, 280, false)
    rows.push({ title: title.text, body: body.text || "—" })
    if (title.clipped || body.clipped) overflow.push(`**${term}.** ${description}`)
  }
  if (rows.length === 0) {
    ctx.warnings.push("definition-list had no items")
    return []
  }
  const groups = chunk(rows, 12).map((piece, index) => ({
    label: index === 0 ? "Definitions" : `Definitions (${index + 1})`,
    rows: piece,
  }))
  const ledgers = chunk(groups, 4).map((groupChunk) => emit("ledger", { groups: groupChunk }))
  if (overflow.length === 0) return ledgers
  return [...ledgers, detailsNode("Full definitions", [prose(overflow.join("\n\n"))])]
}

function portBadge(node: PortNode): PortNode[] {
  const label = stringProp(node, "label") || stringProp(node, "text") || stringProp(node, "title")
  if (!label) return []
  return [emit("ledger", {
    groups: [{ label: "Status", rows: [{ title: clip(label, 60, true).text, body: clip(stringProp(node, "description") || label, 280, false).text }] }],
  })]
}

function portTable(node: PortNode): PortNode {
  const props: Record<string, unknown> = {}
  const dataKey = stringProp(node, "dataKey")
  if (dataKey) props.dataKey = dataKey
  const columns = normalizeColumns(node.props?.columns)
  if (columns.length) props.columns = columns
  const caption = stringProp(node, "caption")
  if (caption) props.caption = caption
  const statusKey = stringProp(node, "statusKey")
  if (statusKey) props.statusKey = statusKey
  if (node.props?.dense === true) props.dense = true
  if (node.props?.onlyDiffs === true) props.onlyDiffs = true
  return emit("table", props)
}

function portProcess(node: PortNode, ctx: PortContext): PortNode[] {
  const items = Array.isArray(node.props?.items) ? node.props.items : []
  const records = items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
  if (records.length === 0) {
    ctx.warnings.push(`${node.type} had no items`)
    return []
  }
  const caption = [stringProp(node, "title"), stringProp(node, "caption")].filter(Boolean).join(". ")
  const states = records.map((item) => checklistState(stringOf(item.status)))
  const checklistFits = states.every((state) => state !== null) && records.length <= 20 && records.every((item) => {
    const title = stringOf(item.title) || stringOf(item.label) || "Step"
    const note = stringOf(item.description) || stringOf(item.body)
    return title.length <= 140 && note.length <= 140
  })
  if (checklistFits) {
    const checklist = emit("checklist", {
      items: records.map((item, index) => {
        const entry: Record<string, unknown> = {
          text: clip(stringOf(item.title) || stringOf(item.label) || "Step", 140, true).text,
          state: states[index],
        }
        const note = stringOf(item.description) || stringOf(item.body)
        if (note) entry.note = note
        return entry
      }),
    })
    return caption ? [prose(caption), checklist] : [checklist]
  }

  const overflow: string[] = []
  const steps = records.map((item) => {
    const fullTitle = stringOf(item.title) || stringOf(item.label) || "Step"
    const label = stringOf(item.label)
    const description = stringOf(item.description) || stringOf(item.body)
    const title = clip(fullTitle, 40, true)
    let bodySource = description
    if (!bodySource && label && label !== fullTitle) bodySource = label
    if (bodySource && label && label !== fullTitle && !bodySource.includes(label) && label.length > 24) {
      bodySource = `${label}. ${bodySource}`
    }
    const body = bodySource ? clip(bodySource, 100, false) : { text: "", clipped: false }
    const tag = label && label !== fullTitle && label.length <= 24 ? label : ""
    if (title.clipped || body.clipped) overflow.push(`**${fullTitle}.** ${[label, description].filter(Boolean).join(" — ")}`)
    const entry: Record<string, unknown> = { title: title.text || "Step" }
    if (body.text) entry.body = body.text
    if (tag) entry.tag = tag
    const state = checklistState(stringOf(item.status))
    if (state === "doing") entry.key = true
    return entry
  })
  const nodes: PortNode[] = []
  if (steps.length === 1) {
    const only = records[0]
    nodes.push(prose(`**${stringOf(only.title) || "Step"}.** ${stringOf(only.description) || stringOf(only.body) || stringOf(only.label)}`.trim()))
  } else {
    const pieces = splitBalanced(steps, 7, 2)
    pieces.forEach((piece, index) => {
      const props: Record<string, unknown> = { items: piece }
      if (index === 0 && caption) props.caption = clip(caption, 240, true).text
      nodes.push(emit("steps", props))
    })
  }
  if (overflow.length) nodes.push(detailsNode("Full step notes", [prose(overflow.join("\n\n"))]))
  return nodes
}

function portTrend(node: PortNode): PortNode {
  const dataKey = stringProp(node, "dataKey") || "series"
  const x = stringProp(node, "x") || stringProp(node, "xKey") || "x"
  const y = node.props?.y ?? node.props?.yKey ?? "y"
  const kind = node.props?.kind === "bar" ? "bar" : "line"
  const captionSource = stringProp(node, "caption") || stringProp(node, "label") || (node.type === "area-chart" ? "Area trend" : "Trend")
  return emit("trend", { dataKey, x, y, kind, caption: clip(captionSource, 240, true).text })
}

function portSlices(node: PortNode, ctx: PortContext, preferFigures: boolean): PortNode[] {
  const dataKey = stringProp(node, "dataKey")
  const rows = dataKey ? datasetRows(ctx.data, dataKey) : null
  const labelKey = stringProp(node, "labelKey") || stringProp(node, "nameKey") || "label"
  const valueKey = stringProp(node, "valueKey") || "value"
  if (preferFigures && rows && rows.length > 0 && rows.length <= 4 && rows.every((row) => row[labelKey] != null && row[valueKey] != null)) {
    return figuresFromStats(rows.map((row) => ({
      type: "stat-card",
      props: { label: stringOf(row[labelKey]), value: row[valueKey], caption: stringProp(node, "caption") || stringProp(node, "label") },
    })), ctx, false)
  }
  if (dataKey) return [portTable({ ...node, props: { ...(node.props ?? {}), dataKey, caption: stringProp(node, "caption") || stringProp(node, "label") } })]
  ctx.warnings.push(`${node.type} had no dataset`)
  return []
}

function portAlert(node: PortNode): PortNode[] {
  const title = stringProp(node, "title")
  const description = stringProp(node, "description") || stringProp(node, "body") || title
  if (!description) return []
  const body = clip(description, 400, false)
  const props: Record<string, unknown> = { tone: alertTone(stringProp(node, "variant") || stringProp(node, "tone")), body: body.text }
  if (title && title !== description) props.title = clip(title, 80, true).text
  const nodes = [emit("callout", props)]
  if (body.clipped) nodes.push(prose(description))
  return nodes
}

function portAccordion(node: PortNode, ctx: PortContext): PortNode[] {
  const items = Array.isArray(node.props?.items) ? node.props.items : []
  const details: PortNode[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const summary = clip(stringOf(record.title) || stringOf(record.summary) || "Details", 80, true).text
    const children = transformList(asNodes(record.nodes ?? record.children), ctx)
    details.push(detailsNode(summary, children.length ? children : [prose(summary)]))
  }
  return details
}

function portCodeBlock(node: PortNode): PortNode[] {
  const code = typeof node.props?.code === "string" ? node.props.code : ""
  if (!code.trim()) return []
  const props: Record<string, unknown> = { code }
  const language = stringProp(node, "language") || (node.type === "log" ? "log" : "")
  if (language) props.language = language
  const title = stringProp(node, "title")
  if (title) props.title = title
  const caption = stringProp(node, "caption")
  if (caption) props.caption = caption
  if (title && (title.includes("/") || /\.[a-z0-9]+$/i.test(title))) props.file = title
  if (node.props?.lineNumbers === true || node.props?.showLineNumbers === true) props.lineNumbers = true
  if (node.props?.sketch === true) props.sketch = true
  return [emit("code", props)]
}

function portDiff(node: PortNode): PortNode[] {
  const content = typeof node.props?.content === "string" ? node.props.content : typeof node.props?.code === "string" ? node.props.code : ""
  if (!content.trim()) return []
  const split = splitUnifiedDiff(content)
  const props: Record<string, unknown> = {}
  const language = stringProp(node, "language")
  if (language) props.language = language
  const title = stringProp(node, "title")
  if (title) props.title = title
  const caption = stringProp(node, "caption")
  if (caption) props.caption = caption
  const mode = stringProp(node, "mode")
  if (mode === "unified" || mode === "split") props.diffMode = mode
  if (split) {
    props.before = split.before
    props.after = split.after
  } else {
    props.code = content
    props.diff = true
  }
  return [emit("code", props)]
}

interface StackRow {
  call: string
  note?: string
  at?: string
  excerpt?: { code: string; language?: string; startLine?: number }
}

function portCallStack(node: PortNode, ctx: PortContext): PortNode[] {
  const rawRows = Array.isArray(node.props?.rows) ? node.props.rows : []
  const normalized = normalizeCallStackRows(rawRows as Parameters<typeof normalizeCallStackRows>[0])
  const rows: StackRow[] = normalized.rows.length ? normalized.rows : rawRows.flatMap((row): StackRow[] => {
    if (typeof row === "string" && row.trim()) return [{ call: row.trim() }]
    if (row && typeof row === "object" && typeof (row as { call?: unknown }).call === "string") {
      const record = row as StackRow
      return [{ call: record.call, note: record.note, at: record.at, excerpt: record.excerpt }]
    }
    return []
  })
  if (rows.length === 0) {
    ctx.warnings.push("call-stack had no rows")
    return []
  }
  const withExcerpt = rows.filter((row) => row.excerpt?.code?.trim())
  const title = stringProp(node, "title")
  const caption = stringProp(node, "caption")
  if (withExcerpt.length >= 2) {
    return walkthroughsFromCalls(withExcerpt, title, caption)
  }
  if (withExcerpt.length === 1) {
    const excerpt = withExcerpt[0].excerpt!
    const codeNode = emit("code", {
      ...(title ? { title } : {}),
      ...(caption ? { caption } : {}),
      ...(excerpt.language ? { language: excerpt.language } : {}),
      ...(excerpt.startLine ? { startLine: excerpt.startLine } : {}),
      code: excerpt.code,
    })
    return [codeNode, ...callSteps(rows, caption)]
  }
  return callSteps(rows, caption || title)
}

function portQuotes(node: PortNode): PortNode[] {
  const items = Array.isArray(node.props?.items) ? node.props.items : Array.isArray(node.props?.quotes) ? node.props.quotes : []
  const quotes: PortNode[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const text = stringOf(record.text) || stringOf(record.quote)
    if (!text) continue
    const clipped = clip(text, 400, false)
    const props: Record<string, unknown> = { text: clipped.text }
    const from = stringOf(record.from) || stringOf(record.author) || stringOf(record.source)
    if (from) props.from = clip(from, 60, true).text
    quotes.push(emit("quote", props))
    if (clipped.clipped) quotes.push(prose(text))
  }
  return quotes
}

function portButton(node: PortNode): PortNode[] {
  const label = stringProp(node, "label") || stringProp(node, "text") || "Link"
  const href = stringProp(node, "href") || stringProp(node, "url")
  if (!href) return [prose(label)]
  return [emit("links", { items: [{ label: clip(label, 60, true).text, href }] })]
}

function portBox(node: PortNode, ctx: PortContext): PortNode[] {
  const boxes = Array.isArray(node.props?.nodes) ? node.props.nodes : []
  const edges = Array.isArray(node.props?.edges) ? node.props.edges : []
  if (boxes.length >= 2 && boxes.length <= 6 && edges.length <= 8) {
    const mapped = boxes.flatMap((box) => {
      if (!box || typeof box !== "object") return []
      const record = box as Record<string, unknown>
      const id = stringOf(record.id)
      const label = stringOf(record.label) || id
      if (!id || !/^[a-z][a-z0-9-]{0,30}$/.test(id)) return []
      return [{ id, label: clip(label, 28, true).text }]
    })
    const edgeText = edges.filter((edge): edge is string => typeof edge === "string")
    if (mapped.length === boxes.length && edgeText.length === edges.length) {
      return [emit("map", {
        caption: clip(stringProp(node, "caption") || stringProp(node, "title") || "Diagram", 240, true).text,
        nodes: mapped,
        edges: edgeText,
      })]
    }
  }
  ctx.warnings.push("box-diagram did not fit map limits; listed its boxes as steps")
  const labels = boxes.map((box) => {
    if (!box || typeof box !== "object") return "Box"
    const record = box as Record<string, unknown>
    return stringOf(record.label) || stringOf(record.id) || "Box"
  })
  if (labels.length < 2) return labels.length ? [prose(labels[0])] : []
  return portProcess({
    type: "flow",
    props: { title: stringProp(node, "title"), caption: stringProp(node, "caption"), items: labels.map((label) => ({ title: label })) },
  }, ctx)
}

function portSequence(node: PortNode, ctx: PortContext): PortNode[] {
  const participants = node.props?.participants
  const steps = Array.isArray(node.props?.steps) ? node.props.steps : []
  if (!Array.isArray(participants) || steps.length === 0) {
    ctx.warnings.push("sequence-diagram was missing participants or steps")
    return []
  }
  const caption = clip(stringProp(node, "caption") || stringProp(node, "title") || "Sequence", 240, true).text
  const title = stringProp(node, "title")
  return splitBalanced(steps, 10, 1).map((piece, index) => emit("sequence", {
    ...(index === 0 && title ? { title: clip(title, 120, true).text } : {}),
    caption: index === 0 ? caption : `${caption} (${index + 1})`,
    participants,
    steps: piece,
  }))
}

function figuresFromStats(nodes: PortNode[], ctx: PortContext, record = true): PortNode[] {
  const overflow: string[] = []
  const items = nodes.map((node) => {
    const label = stringProp(node, "label") || "Metric"
    const rawValue = node.props?.value
    const valueText = rawValue == null ? "—" : String(rawValue)
    const caption = stringProp(node, "caption")
    const delta = stringProp(node, "delta")
    const trend = typeof node.props?.trend === "string" ? node.props.trend : ""
    const noteSource = [valueText.length > 24 ? valueText : "", caption, delta, trend].filter(Boolean).join(" · ")
    const note = noteSource ? clip(noteSource, 80, true) : { text: "", clipped: false }
    const labelClip = clip(label, 40, true)
    const value = typeof rawValue === "number" && Number.isFinite(rawValue)
      ? rawValue
      : clip(valueText, 24, true).text
    if (labelClip.clipped || note.clipped || (typeof value === "string" && value !== valueText)) {
      overflow.push(`**${label}.** ${valueText}${caption ? ` — ${caption}` : ""}`)
    }
    const item: Record<string, unknown> = { value, label: labelClip.text || "Metric" }
    if (note.text) item.note = note.text
    const signal = statSignal(stringProp(node, "tone"))
    if (signal) item.signal = signal
    return item
  })
  if (items.length === 0) return []
  if (record) {
    for (const node of nodes) {
      if (REMOVED.has(node.type)) ctx.counts.set(node.type, (ctx.counts.get(node.type) ?? 0) + 1)
    }
  }
  const figures = chunk(items, 4).map((piece) => emit("figures", { items: piece }))
  if (overflow.length) figures.push(prose(overflow.join("\n\n")))
  return figures
}

function columnsFromCards(nodes: PortNode[], ctx: PortContext): PortNode[] {
  const proseNodes = nodes.flatMap((node) => {
    ctx.counts.set("card", (ctx.counts.get("card") ?? 0) + 1)
    const proseNode = cardToProse(node)
    return proseNode ? [proseNode] : []
  })
  return chunkColumns(proseNodes)
}

function cardToProse(node: PortNode): PortNode | null {
  const parts: string[] = []
  const title = stringProp(node, "title")
  const description = stringProp(node, "description")
  if (title) parts.push(`### ${title}`)
  if (description) parts.push(description)
  for (const child of childNodes(node)) {
    const text = stringProp(child, "content") || stringProp(child, "text")
    if (text) parts.push(text)
  }
  const content = parts.join("\n\n").trim()
  return content ? prose(content) : null
}

function textToProse(node: PortNode): PortNode[] {
  const text = stringProp(node, "text")
  if (!text.trim()) return []
  const size = stringProp(node, "size")
  const props: Record<string, unknown> = { content: text }
  if (size === "lg" || size === "xl") props.size = "lead"
  return [emit("prose", props)]
}

function chapterNode(title: string, deck: string, children: PortNode[], ctx: PortContext): PortNode {
  const fullTitle = title.trim() || "Section"
  const titleClip = clip(fullTitle, 80, true)
  const kids = transformList(children, ctx)
  if (titleClip.clipped) kids.unshift(prose(fullTitle))
  let deckText = deck.trim()
  if (deckText.length > 200) {
    kids.unshift(prose(deckText))
    deckText = clip(deckText, 200, true).text
  }
  const props: Record<string, unknown> = { title: titleClip.text || "Section" }
  if (deckText) props.deck = deckText
  return emit("chapter", props, kids)
}

function groupHeadings(nodes: PortNode[]): PortNode[] {
  if (!nodes.some((node) => node.type === "heading")) return nodes
  const out: PortNode[] = []
  let index = 0
  while (index < nodes.length && nodes[index].type !== "heading") out.push(nodes[index++])
  while (index < nodes.length) {
    const heading = nodes[index++]
    const children: PortNode[] = []
    while (index < nodes.length && nodes[index].type !== "heading") children.push(nodes[index++])
    const title = stringOf(heading.props?.text) || "Section"
    const clipped = clip(title, 80, true)
    const kids = clipped.clipped ? [prose(title), ...children] : children
    out.push(emit("chapter", { title: clipped.text || "Section" }, kids.length ? kids : undefined))
  }
  return out
}

function detailsNode(summary: string, children: PortNode[]): PortNode {
  return emit("details", { summary: clip(summary, 80, true).text }, children.length ? children : [prose(summary)])
}

function walkthroughsFromCalls(rows: Array<{ call: string; note?: string; excerpt?: { code: string; language?: string; startLine?: number }; at?: string }>, title: string, caption: string): PortNode[] {
  const files = rows.map((row, index) => {
    const excerpt = row.excerpt!
    const located = locate(row.at)
    const start = excerpt.startLine ?? located?.start ?? 1
    const lineCount = excerpt.code.replace(/\n$/, "").split("\n").length
    const end = start + lineCount - 1
    const basePath = located?.path || `frame-${index + 1}.txt`
    return {
      path: basePath,
      code: excerpt.code,
      language: excerpt.language,
      startLine: start > 1 ? start : undefined,
      lines: start === end ? String(start) : `${start}-${end}`,
      title: clip(row.call, 80, true).text,
      body: clip([clip(row.call, 80, true).clipped ? row.call : "", row.note ?? ""].filter(Boolean).join(" — "), 400, false).text,
    }
  })
  const used = new Map<string, number>()
  for (const file of files) {
    const count = used.get(file.path) ?? 0
    used.set(file.path, count + 1)
    if (count > 0) file.path = `${file.path}#${count + 1}`
  }
  const nodes: PortNode[] = []
  for (let index = 0; index < files.length; ) {
    const slice = files.slice(index, index + 4)
    const steps = slice.slice(0, 8)
    if (steps.length < 2) {
      const only = steps[0]
      nodes.push(emit("code", {
        code: only.code,
        ...(only.language ? { language: only.language } : {}),
        ...(only.startLine ? { startLine: only.startLine } : {}),
        title: only.title,
        file: only.path,
      }))
      index += steps.length
      continue
    }
    nodes.push(emit("walkthrough", {
      ...(title ? { title: nodes.length === 0 ? title : `${clip(title, 70, true).text} (${nodes.length + 1})` } : {}),
      ...(caption && nodes.length === 0 ? { caption } : {}),
      files: steps.map((file) => ({
        path: file.path,
        code: file.code,
        ...(file.language ? { language: file.language } : {}),
        ...(file.startLine ? { startLine: file.startLine } : {}),
      })),
      steps: steps.map((file) => ({
        file: steps.length > 1 ? file.path : undefined,
        lines: file.lines,
        title: file.title,
        ...(file.body ? { body: file.body } : {}),
      })).map((step) => {
        if (!step.file) delete step.file
        return step
      }),
    }))
    index += steps.length
  }
  return nodes
}

function callSteps(rows: Array<{ call: string; note?: string; at?: string }>, caption: string): PortNode[] {
  if (rows.length < 2) {
    const only = rows[0]
    return [prose([`**${only.call}**`, only.at, only.note].filter(Boolean).join(" — "))]
  }
  const items = rows.map((row) => {
    const title = clip(row.call, 40, true)
    const body = clip([row.at, row.note].filter(Boolean).join(" — "), 100, true)
    const item: Record<string, unknown> = { title: title.text || "Call" }
    if (body.text) item.body = body.text
    return item
  })
  return splitBalanced(items, 7, 2).map((piece, index) => emit("steps", {
    items: piece,
    ...(index === 0 && caption ? { caption: clip(caption, 240, true).text } : {}),
  }))
}

function chunkColumns(children: PortNode[]): PortNode[] {
  if (children.length < 2) return children
  const chunks: PortNode[][] = []
  let rest = children.slice()
  while (rest.length) {
    let take = Math.min(3, rest.length)
    if (rest.length - take === 1) take = Math.max(2, take - 1)
    chunks.push(rest.slice(0, take))
    rest = rest.slice(take)
  }
  return chunks.map((piece) => emit("columns", { count: piece.length === 2 ? 2 : 3 }, piece))
}

function splitUnifiedDiff(content: string): { before: string; after: string } | null {
  const before: string[] = []
  const after: string[] = []
  let changed = false
  for (const line of content.split("\n")) {
    if (/^(diff |index |--- |\+\+\+ |@@)/.test(line) || line.startsWith("\\")) continue
    if (line.startsWith("+")) {
      after.push(line.slice(1))
      changed = true
    } else if (line.startsWith("-")) {
      before.push(line.slice(1))
      changed = true
    } else {
      const text = line.startsWith(" ") ? line.slice(1) : line
      before.push(text)
      after.push(text)
    }
  }
  if (!changed) return null
  return { before: before.join("\n"), after: after.join("\n") }
}

function alertTone(variant: string): "note" | "risk" | "new" | "wait" {
  const value = variant.toLowerCase()
  if (/(destructive|danger|error|risk)/.test(value)) return "risk"
  if (/(warn|wait)/.test(value)) return "wait"
  if (/(success|new)/.test(value)) return "new"
  return "note"
}

function statSignal(tone: string): "new" | "risk" | "wait" | undefined {
  const value = tone.toLowerCase()
  if (/(danger|warning|risk)/.test(value)) return "risk"
  if (/(accent|success|new)/.test(value)) return "new"
  return undefined
}

function ledgerSignal(status: string): LedgerSignal {
  const value = status.trim().toLowerCase()
  if (/(fail|error|danger|blocked|critical|high|\brisk\b)/.test(value)) return "risk"
  if (/(warn|partial|defer|pending|wait|medium|required)/.test(value)) return "wait"
  if (/(^new$|recommend)/.test(value)) return "new"
  if (/(ok|pass|healthy|done|complete|success|validated|trusted|\blow\b)/.test(value)) return "done"
  return "none"
}

function checklistState(status: string): ChecklistState | null {
  const value = status.trim().toLowerCase()
  return PROGRESS_STATES[value as keyof typeof PROGRESS_STATES] ?? null
}

function isStat(node: PortNode): boolean {
  return node.type === "stat-card" || node.type === "metric" || node.type === "change-stats"
}

function isTextCard(node: PortNode): boolean {
  return node.type === "card" && childNodes(node).every((child) => child.type === "text" || child.type === "prose" || child.type === "heading")
}

function childNodes(node: PortNode): PortNode[] {
  if (Array.isArray(node.children)) return node.children
  if (Array.isArray(node.props?.children)) return node.props.children as PortNode[]
  return []
}

function asNodes(value: unknown): PortNode[] {
  if (!Array.isArray(value)) return []
  return value.filter((node): node is PortNode => Boolean(node) && typeof node === "object" && typeof (node as PortNode).type === "string")
}

function datasetRows(data: Record<string, unknown>, key: string): Record<string, unknown>[] | null {
  const value = data[key]
  if (!Array.isArray(value)) return null
  if (!value.every((row) => row && typeof row === "object" && !Array.isArray(row))) return null
  return value as Record<string, unknown>[]
}

function firstFilledKey(rows: Record<string, unknown>[], keys: string[]): string {
  return keys.find((key) => rows.some((row) => stringOf(row[key]).trim())) ?? ""
}

function normalizeColumns(value: unknown): Array<string | { key: string; label?: string; align?: "left" | "center" | "right" }> {
  if (!Array.isArray(value)) return []
  const columns: Array<string | { key: string; label?: string; align?: "left" | "center" | "right" }> = []
  for (const column of value) {
    if (typeof column === "string" && column.trim()) {
      columns.push(column)
      continue
    }
    if (!column || typeof column !== "object") continue
    const record = column as Record<string, unknown>
    const key = stringOf(record.key)
    if (!key) continue
    const next: { key: string; label?: string; align?: "left" | "center" | "right" } = { key }
    const label = stringOf(record.label)
    if (label) next.label = label
    if (record.align === "left" || record.align === "center" || record.align === "right") next.align = record.align
    columns.push(next)
  }
  return columns
}

function sanitizeLayout(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const layout: Record<string, unknown> = {}
  if (record.type === "default" || record.type === "grid") layout.type = record.type
  if (record.columns === 1 || record.columns === 2 || record.columns === 3 || record.columns === 4) layout.columns = record.columns
  return Object.keys(layout).length ? layout : undefined
}

function locate(at?: string): { path: string; start?: number } | undefined {
  if (!at) return undefined
  const match = /^(.*):(\d+)(?:-\d+)?$/.exec(at)
  if (!match) return { path: at }
  return { path: match[1], start: Number(match[2]) }
}

function stringProp(node: PortNode, key: string): string {
  return stringOf(node.props?.[key])
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function prose(content: string): PortNode {
  return emit("prose", { content })
}

function emit(type: string, props?: Record<string, unknown>, children?: PortNode[], metadata?: { id: string }): PortNode {
  const node: PortNode = { type }
  if (props && Object.keys(props).length) node.props = props
  if (children?.length) node.children = children
  if (metadata?.id) node.metadata = { id: metadata.id }
  return node
}

function clip(value: string, max: number, collapse: boolean): Clip {
  const text = (collapse ? value.replace(/\s+/g, " ") : value).trim()
  if (text.length <= max) return { text, clipped: false }
  const ellipsis = "…"
  const room = Math.max(1, max - ellipsis.length)
  let cut = text.slice(0, room)
  if (collapse) {
    const space = cut.lastIndexOf(" ")
    if (space >= Math.floor(room * 0.6)) cut = cut.slice(0, space)
    cut = cut.replace(/[,\s.;:–—-]+$/u, "")
  }
  if (!cut) cut = text.slice(0, room)
  const out = `${cut}${ellipsis}`
  return { text: out.length <= max ? out : text.slice(0, max), clipped: true }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}

function splitBalanced<T>(items: T[], max: number, min: number): T[][] {
  if (items.length <= max) return [items]
  const chunks: T[][] = []
  let rest = items.slice()
  while (rest.length) {
    let take = Math.min(max, rest.length)
    if (rest.length - take > 0 && rest.length - take < min) take = rest.length - min
    if (take < min) take = rest.length
    chunks.push(rest.slice(0, take))
    rest = rest.slice(take)
  }
  return chunks
}
