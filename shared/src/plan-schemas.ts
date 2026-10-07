// Props schemas and lints for the html-plan visual nodes (node-specs.md).
// Node wrappers live in artifact-schema.ts; spec-level lints are in lintPlanSpec below.
import { z } from "zod"

import {
  ChangeMarkSchema,
  GridRowSchema,
  PlanIdSchema,
  ShortLabel,
  SourceRefSchema,
} from "./plan-primitives.js"
import { checkGrid, parseGridRows, type TerseError } from "./terse/common.js"
import { normalizeCallStackRows } from "./terse/call-stack.js"
import { normalizeSequenceSteps } from "./terse/sequence.js"
import { normalizeBoxEdges } from "./terse/edges.js"
import { normalizeMachineEvents } from "./terse/machine.js"

type Ctx = z.RefinementCtx

function report(ctx: Ctx, path: (string | number)[], message: string) {
  ctx.addIssue({ code: "custom", path, message })
}

function reportTerse(ctx: Ctx, field: string, errors: TerseError[]) {
  for (const error of errors) report(ctx, [field, error.index], error.message)
}

const HttpsUrlSchema = z.string().url().regex(/^https:\/\//, "must be an https URL")

// ---------------------------------------------------------------------------
// alert (improved), change-stats, quotes
// ---------------------------------------------------------------------------

export const CalloutToneSchema = z.enum(["info", "warn", "risk", "ok", "idea"])
export type CalloutTone = z.infer<typeof CalloutToneSchema>

export const ChangeStatsPropsSchema = z
  .object({
    label: ShortLabel(40).optional(),
    added: z.number().int().min(0).max(9999),
    changed: z.number().int().min(0).max(9999),
    removed: z.number().int().min(0).max(9999),
    files: z.number().int().min(0).max(9999).optional(),
    lines: z.object({ add: z.number().int().min(0), del: z.number().int().min(0) }).strict().optional(),
  })
  .strict()
  .superRefine((props, ctx) => {
    const sum = props.added + props.changed + props.removed
    if (props.files !== undefined && props.files < sum) {
      report(ctx, ["files"], `change-stats files (${props.files}) must be at least added + changed + removed (${sum})`)
    }
  })
export type ChangeStatsProps = z.infer<typeof ChangeStatsPropsSchema>

export const QUOTE_SOURCES = ["prompt", "slack", "github", "doc", "email", "meeting", "transcript"] as const
export const QuotesPropsSchema = z
  .object({
    title: ShortLabel(80).optional(),
    open: z.boolean().optional(),
    items: z
      .array(
        z
          .object({
            text: z.string().min(1).max(600),
            via: z.enum(QUOTE_SOURCES),
            from: ShortLabel(60).optional(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
            href: HttpsUrlSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()
export type QuotesProps = z.infer<typeof QuotesPropsSchema>

// ---------------------------------------------------------------------------
// code-block (improved)
// ---------------------------------------------------------------------------

export const CodeAnnotationToneSchema = z.enum(["info", "warn", "risk", "ok"])
export const CodeBlockPropsSchema = z
  .object({
    title: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    code: z.string().min(1),
    caption: z.string().min(1).optional(),
    lineNumbers: z.boolean().optional(),
    startLine: z.number().int().min(1).max(1_000_000).optional(),
    highlight: z.array(z.union([z.number().int().min(1), z.string().regex(/^\d+-\d+$/)])).max(40).optional(),
    annotations: z
      .array(
        z
          .object({
            line: z.number().int().min(1),
            title: ShortLabel(80),
            body: ShortLabel(280).optional(),
            tone: CodeAnnotationToneSchema.optional(),
          })
          .strict(),
      )
      .max(12)
      .optional(),
    diff: z.boolean().optional(),
    sketch: z.boolean().optional(),
    src: SourceRefSchema.optional(),
  })
  .strict()
  .superRefine((props, ctx) => {
    const lines = props.code.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n")
    const first = props.startLine ?? 1
    const last = first + lines.length - 1
    const inRange = (n: number) => n >= first && n <= last
    const seen = new Set<number>()
    props.annotations?.forEach((annotation, index) => {
      if (!inRange(annotation.line)) {
        report(ctx, ["annotations", index, "line"], `code-block annotation ${index + 1}: line ${annotation.line} is outside ${first}-${last}`)
      }
      if (seen.has(annotation.line)) {
        report(ctx, ["annotations", index, "line"], `code-block annotation ${index + 1}: line ${annotation.line} already has an annotation`)
      }
      seen.add(annotation.line)
    })
    props.highlight?.forEach((entry, index) => {
      const [a, b] = typeof entry === "number" ? [entry, entry] : entry.split("-").map(Number)
      if (b < a || !inRange(a) || !inRange(b)) {
        report(ctx, ["highlight", index], `code-block highlight ${index + 1}: "${entry}" is outside ${first}-${last}`)
      }
    })
    if (props.diff) {
      lines.forEach((line, index) => {
        if (line === "" || /^[+\- ]/.test(line) || line.startsWith("@@")) return
        report(ctx, ["code"], `line ${index + 1}: diff lines start with "+ ", "- ", "  " or "@@"`)
      })
    }
  })
export type CodeBlockProps = z.infer<typeof CodeBlockPropsSchema>

/** True when a code-block uses any structured (annotated) prop. */
export function codeBlockIsStructured(props: CodeBlockProps): boolean {
  return Boolean(
    props.lineNumbers !== undefined ||
      props.startLine !== undefined ||
      props.highlight?.length ||
      props.annotations?.length ||
      props.diff ||
      props.sketch ||
      props.src,
  )
}

// ---------------------------------------------------------------------------
// call-stack
// ---------------------------------------------------------------------------

export const CallRowObjectSchema = z
  .object({
    call: ShortLabel(160),
    depth: z.number().int().min(0).max(12),
    mark: ChangeMarkSchema.optional(),
    at: SourceRefSchema.optional(),
    note: ShortLabel(120).optional(),
    kind: z.enum(["call", "ui", "net", "cond", "io", "gap"]).optional(),
    id: PlanIdSchema.optional(),
    excerpt: z
      .object({
        code: z.string().min(1).max(4000),
        language: ShortLabel(30).optional(),
        startLine: z.number().int().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const CALL_STACK_EXCERPT_BUDGET = 32 * 1024

export const CallStackPropsSchema = z
  .object({
    title: ShortLabel(120).optional(),
    caption: ShortLabel(240).optional(),
    rows: z.array(z.union([z.string().min(1).max(400), CallRowObjectSchema])).min(1).max(60),
    repo: z
      .object({ name: ShortLabel(80), ref: ShortLabel(64).optional(), baseUrl: HttpsUrlSchema.optional() })
      .strict()
      .optional(),
    initialRow: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((props, ctx) => {
    const { rows, errors } = normalizeCallStackRows(props.rows)
    reportTerse(ctx, "rows", errors)
    const ids = new Set<string>()
    let missingAt = 0
    let excerptBytes = 0
    rows.forEach((row, index) => {
      if (row.id) {
        if (ids.has(row.id)) report(ctx, ["rows", index], `call-stack row ${index + 1}: id "${row.id}" is used twice`)
        ids.add(row.id)
      }
      if (row.mark !== "context" && !row.at && row.kind !== "gap") missingAt++
      if (row.excerpt) excerptBytes += row.excerpt.code.length
    })
    if (missingAt > 2) {
      report(ctx, ["rows"], `${missingAt} changed calls have no location; end the line with @ path/file.ts:line`)
    }
    if (excerptBytes > CALL_STACK_EXCERPT_BUDGET) {
      report(ctx, ["rows"], `call-stack excerpts total ${excerptBytes} bytes; keep them under ${CALL_STACK_EXCERPT_BUDGET}`)
    }
    if (props.initialRow !== undefined && props.initialRow >= props.rows.length) {
      report(ctx, ["initialRow"], `call-stack initialRow ${props.initialRow} is past the last row (${props.rows.length - 1})`)
    }
  })
export type CallStackProps = z.infer<typeof CallStackPropsSchema>

/** Row ids declared by a call-stack's object rows (for claim.ref). */
export function callStackRowIds(props: { rows: readonly unknown[] }): string[] {
  return props.rows.flatMap((row) =>
    row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string" ? [(row as { id: string }).id] : [],
  )
}

// ---------------------------------------------------------------------------
// sequence-diagram
// ---------------------------------------------------------------------------

const SequenceStepObjectSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("message"),
      from: PlanIdSchema,
      to: PlanIdSchema,
      text: ShortLabel(60),
      style: z.enum(["call", "reply", "lost"]).optional(),
      mark: ChangeMarkSchema.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("note"), over: z.array(PlanIdSchema).min(1).max(2), text: ShortLabel(120) }).strict(),
  z.object({ kind: z.literal("divider"), text: ShortLabel(60) }).strict(),
])

export const SequenceDiagramPropsSchema = z
  .object({
    title: ShortLabel(120).optional(),
    caption: ShortLabel(240),
    participants: z
      .array(
        z
          .object({
            id: PlanIdSchema,
            label: ShortLabel(28).optional(),
            kind: z.enum(["actor", "service", "store", "external"]).optional(),
            mark: ChangeMarkSchema.optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    steps: z.array(z.union([z.string().min(1).max(200), SequenceStepObjectSchema])).min(1).max(40),
  })
  .strict()
  .superRefine((props, ctx) => {
    const ids = new Set<string>()
    props.participants.forEach((participant, index) => {
      if (ids.has(participant.id)) report(ctx, ["participants", index, "id"], `participant "${participant.id}" is declared twice`)
      ids.add(participant.id)
    })
    const { steps, errors } = normalizeSequenceSteps(props.steps)
    reportTerse(ctx, "steps", errors)
    const uses = new Map<string, number>()
    steps.forEach((step, index) => {
      const ends = step.kind === "message" ? [step.from, step.to] : step.kind === "note" ? step.over : []
      for (const end of ends) {
        if (!ids.has(end)) report(ctx, ["steps", index], `step ${index + 1}: unknown participant "${end}"`)
      }
      if (step.kind === "message") {
        uses.set(step.from, (uses.get(step.from) ?? 0) + 1)
        if (step.to !== step.from) uses.set(step.to, (uses.get(step.to) ?? 0) + 1)
      }
    })
    if (props.participants.length >= 4 && errors.length === 0) {
      props.participants.forEach((participant, index) => {
        if ((uses.get(participant.id) ?? 0) < 2) {
          report(ctx, ["participants", index], `participant "${participant.id}" appears in one message — fold it into a note or drop it`)
        }
      })
    }
  })
export type SequenceDiagramProps = z.infer<typeof SequenceDiagramPropsSchema>

// ---------------------------------------------------------------------------
// box-diagram
// ---------------------------------------------------------------------------

export const BOX_TONES = ["default", "accent", "green", "amber", "red", "blue", "muted"] as const
const BoxEdgeObjectSchema = z
  .object({
    from: PlanIdSchema,
    to: PlanIdSchema,
    label: ShortLabel(44).optional(),
    style: z.enum(["solid", "dashed", "bold"]).optional(),
    both: z.boolean().optional(),
    mark: ChangeMarkSchema.optional(),
  })
  .strict()

export const BoxDiagramPropsSchema = z
  .object({
    title: ShortLabel(120).optional(),
    caption: ShortLabel(240).optional(),
    nodes: z
      .array(
        z
          .object({
            id: PlanIdSchema,
            label: ShortLabel(40),
            sub: ShortLabel(48).optional(),
            shape: z.enum(["box", "pill", "diamond", "db", "circle", "note", "actor"]).optional(),
            tone: z.enum(BOX_TONES).optional(),
            mark: ChangeMarkSchema.optional(),
            href: z.string().regex(/^#[\w-]+$/, "href must be an in-page anchor like #claim-2-1").optional(),
          })
          .strict(),
      )
      .min(1)
      .max(16),
    edges: z.array(z.union([z.string().min(1).max(200), BoxEdgeObjectSchema])).max(40),
    grid: z.array(GridRowSchema).min(1).max(6),
    groups: z.array(z.object({ label: ShortLabel(40), ids: z.array(PlanIdSchema).min(1) }).strict()).max(4).optional(),
    dashed: ShortLabel(40).optional(),
  })
  .strict()
  .superRefine((props, ctx) => {
    const ids = new Set<string>()
    props.nodes.forEach((node, index) => {
      if (ids.has(node.id)) report(ctx, ["nodes", index, "id"], `box-diagram node "${node.id}" is declared twice`)
      ids.add(node.id)
    })
    const { cells, errors: gridErrors } = parseGridRows(props.grid)
    reportTerse(ctx, "grid", gridErrors)
    if (gridErrors.length === 0) {
      for (const error of checkGrid(cells, ids, "node")) report(ctx, ["grid", error.index], error.message)
    }
    const columns = Math.max(0, ...cells.map((row) => row.length))
    if (columns > 4) report(ctx, ["grid"], `box-diagram grid has ${columns} columns; use at most 4 (3 reads best)`)
    const { edges, errors } = normalizeBoxEdges(props.edges)
    reportTerse(ctx, "edges", errors)
    edges.forEach((edge, index) => {
      for (const end of [edge.from, edge.to]) {
        if (!ids.has(end)) report(ctx, ["edges", index], `edge ${index + 1}: unknown node "${end}"`)
      }
    })
    if (edges.some((edge) => edge.style === "dashed") && !props.dashed) {
      report(ctx, ["dashed"], `box-diagram has dashed edges; set "dashed" to say what a dashed line means`)
    }
    const position = new Map<string, [number, number]>()
    cells.forEach((row, r) => row.forEach((cell, c) => cell && position.set(cell, [r, c])))
    props.groups?.forEach((group, index) => {
      const points: [number, number][] = []
      for (const id of group.ids) {
        const at = position.get(id)
        if (!ids.has(id) || !at) {
          report(ctx, ["groups", index], `group ${index + 1}: unknown node "${id}"`)
          return
        }
        points.push(at)
      }
      const rows = points.map((p) => p[0])
      const cols = points.map((p) => p[1])
      const area = (Math.max(...rows) - Math.min(...rows) + 1) * (Math.max(...cols) - Math.min(...cols) + 1)
      if (area !== points.length) {
        report(ctx, ["groups", index], `group ${index + 1} "${group.label}": its nodes must fill a rectangle in the grid`)
      }
    })
  })
export type BoxDiagramProps = z.infer<typeof BoxDiagramPropsSchema>

// ---------------------------------------------------------------------------
// state-machine
// ---------------------------------------------------------------------------

const MachineStateSchema = z
  .object({
    id: PlanIdSchema,
    label: ShortLabel(40).optional(),
    description: ShortLabel(200).optional(),
    final: z.boolean().optional(),
    mark: ChangeMarkSchema.optional(),
    screen: PlanIdSchema.optional(),
    code: SourceRefSchema.optional(),
    sets: ShortLabel(80).optional(),
  })
  .strict()
const MachineEventObjectSchema = z
  .object({
    from: PlanIdSchema,
    event: PlanIdSchema,
    to: PlanIdSchema,
    label: ShortLabel(44).optional(),
    mark: ChangeMarkSchema.optional(),
  })
  .strict()

export const StateMachinePropsSchema = z
  .object({
    title: ShortLabel(120).optional(),
    caption: ShortLabel(240).optional(),
    initial: PlanIdSchema,
    states: z.array(MachineStateSchema).min(2).max(16),
    events: z.array(z.union([z.string().min(1).max(200), MachineEventObjectSchema])).min(1).max(40),
    grid: z.array(GridRowSchema).max(6).optional(),
    traces: z
      .array(z.object({ name: PlanIdSchema, events: z.array(PlanIdSchema).min(1).max(30) }).strict())
      .max(6)
      .optional(),
  })
  .strict()
  .superRefine((props, ctx) => {
    const ids = new Set<string>()
    const finals = new Set<string>()
    props.states.forEach((state, index) => {
      if (ids.has(state.id)) report(ctx, ["states", index, "id"], `state "${state.id}" is declared twice`)
      ids.add(state.id)
      if (state.final) finals.add(state.id)
    })
    if (!ids.has(props.initial)) report(ctx, ["initial"], `initial state "${props.initial}" is not declared`)
    const { events, errors } = normalizeMachineEvents(props.events)
    reportTerse(ctx, "events", errors)
    const pairs = new Set<string>()
    const outgoing = new Map<string, { event: string; to: string }[]>()
    events.forEach((event, index) => {
      for (const end of [event.from, event.to]) {
        if (!ids.has(end)) report(ctx, ["events", index], `event ${index + 1}: unknown state "${end}"`)
      }
      const key = `${event.from}\u0000${event.event}`
      if (pairs.has(key)) report(ctx, ["events", index], `event ${index + 1}: "${event.from}" already has an event "${event.event}"`)
      pairs.add(key)
      const list = outgoing.get(event.from) ?? []
      list.push({ event: event.event, to: event.to })
      outgoing.set(event.from, list)
    })
    if (errors.length === 0 && ids.has(props.initial)) {
      const reached = new Set([props.initial])
      const queue = [props.initial]
      while (queue.length) {
        const current = queue.shift()!
        for (const edge of outgoing.get(current) ?? []) {
          if (!reached.has(edge.to)) {
            reached.add(edge.to)
            queue.push(edge.to)
          }
        }
      }
      props.states.forEach((state, index) => {
        if (!reached.has(state.id)) report(ctx, ["states", index], `state "${state.id}" is unreachable from "${props.initial}"`)
        if (!finals.has(state.id) && !(outgoing.get(state.id)?.length)) {
          report(ctx, ["states", index], `state "${state.id}" has no outgoing events and is not marked final`)
        }
      })
      props.traces?.forEach((trace, traceIndex) => {
        let current = props.initial
        for (let step = 0; step < trace.events.length; step++) {
          const legal = outgoing.get(current) ?? []
          const next = legal.find((edge) => edge.event === trace.events[step])
          if (!next) {
            report(
              ctx,
              ["traces", traceIndex, "events", step],
              `trace ${trace.name}: step ${step + 1} "${trace.events[step]}" is not a legal event from "${current}" (legal: ${legal.map((edge) => edge.event).join(", ") || "none"})`,
            )
            break
          }
          current = next.to
        }
      })
    }
    if (props.grid) {
      const { cells, errors: gridErrors } = parseGridRows(props.grid)
      reportTerse(ctx, "grid", gridErrors)
      if (gridErrors.length === 0) {
        for (const error of checkGrid(cells, ids, "state")) report(ctx, ["grid", error.index], error.message)
      }
    }
  })
export type StateMachineProps = z.infer<typeof StateMachinePropsSchema>

// ---------------------------------------------------------------------------
// mockup + wireframe
// ---------------------------------------------------------------------------

export const MOCKUP_FRAMES = ["none", "browser", "phone", "desktop", "terminal"] as const
export const MockupPropsSchema = z
  .object({
    frame: z.enum(MOCKUP_FRAMES),
    width: z.number().int().min(280).max(1440).optional(),
    label: ShortLabel(60).optional(),
    caption: ShortLabel(240).optional(),
    pins: z
      .array(
        z
          .object({
            n: z.number().int().min(1).max(20).optional(),
            target: PlanIdSchema.optional(),
            x: z.number().min(0).max(1).optional(),
            y: z.number().min(0).max(1).optional(),
            text: ShortLabel(140),
          })
          .strict()
          .refine((pin) => !!pin.target !== (pin.x !== undefined && pin.y !== undefined), "pin needs either target or both x and y"),
      )
      .max(12)
      .optional(),
  })
  .strict()
  .superRefine((props, ctx) => {
    const seen = new Set<number>()
    props.pins?.forEach((pin, index) => {
      const n = pin.n ?? index + 1
      if (seen.has(n)) report(ctx, ["pins", index, "n"], `mockup pin ${index + 1}: number ${n} is used twice`)
      seen.add(n)
    })
  })
export type MockupProps = z.infer<typeof MockupPropsSchema>

export const WIREFRAME_ELEMENTS = [
  "navbar",
  "sidebar",
  "input",
  "textarea",
  "select",
  "toggle",
  "checkbox",
  "avatar",
  "placeholder",
  "skeleton-lines",
  "toast",
  "modal-scrim",
  "divider",
  "prompt",
  "output",
  "spinner",
] as const
export const WireframePropsSchema = z
  .object({
    element: z.enum(WIREFRAME_ELEMENTS),
    text: ShortLabel(200).optional(),
    items: z.array(ShortLabel(40)).max(8).optional(),
    lines: z.number().int().min(1).max(8).optional(),
    state: z.enum(["default", "active", "disabled", "error", "checked"]).optional(),
    mark: ChangeMarkSchema.optional(),
  })
  .strict()
export type WireframeProps = z.infer<typeof WireframePropsSchema>

// ---------------------------------------------------------------------------
// decision
// ---------------------------------------------------------------------------

export const MAX_DECISIONS_PER_SPEC = 5
export const DecisionPropsSchema = z
  .object({
    id: PlanIdSchema,
    question: ShortLabel(200),
    mode: z.enum(["single", "multiple"]).optional(),
    options: z
      .array(
        z
          .object({
            id: PlanIdSchema,
            label: ShortLabel(80),
            consequence: ShortLabel(100).optional(),
            suggested: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(6),
    allowOther: z.boolean().optional(),
  })
  .strict()
  .superRefine((props, ctx) => {
    const ids = new Set<string>()
    props.options.forEach((option, index) => {
      if (ids.has(option.id)) report(ctx, ["options", index, "id"], `decision "${props.id}": option "${option.id}" is declared twice`)
      ids.add(option.id)
    })
    const suggested = props.options.filter((option) => option.suggested).length
    if ((props.mode ?? "single") === "single" && suggested !== 1) {
      report(ctx, ["options"], `decision "${props.id}": a single-choice decision needs exactly 1 suggested option (has ${suggested})`)
    }
    if (props.mode === "multiple" && suggested < 1) {
      report(ctx, ["options"], `decision "${props.id}": mark at least 1 option as suggested`)
    }
  })
export type DecisionProps = z.infer<typeof DecisionPropsSchema>

// ---------------------------------------------------------------------------
// claim-tree + claim
// ---------------------------------------------------------------------------

export const ClaimTreePropsSchema = z
  .object({
    title: ShortLabel(120).optional(),
    open: z.union([z.literal("all"), z.literal(1), z.literal(2), z.literal("needs")]).optional(),
    contents: z.boolean().optional(),
  })
  .strict()
export type ClaimTreeProps = z.infer<typeof ClaimTreePropsSchema>

export const ClaimPropsSchema = z
  .object({
    text: ShortLabel(280),
    aux: z.enum(["shared", "scope"]).optional(),
    ref: PlanIdSchema.optional(),
    open: z.boolean().optional(),
  })
  .strict()
export type ClaimProps = z.infer<typeof ClaimPropsSchema>

export const MAX_CLAIM_DEPTH = 3

// ---------------------------------------------------------------------------
// Spec-level plan lints
// ---------------------------------------------------------------------------

type LooseNode = {
  type: string
  props?: unknown
  children?: LooseNode[]
  metadata?: { id?: string }
}

type Visit = {
  node: LooseNode
  path: (string | number)[]
  parent?: LooseNode
  ancestors: LooseNode[]
}

/** Visits every node, depth first, including tabs/accordion item nodes. */
export function walkPlanNodes(nodes: readonly LooseNode[], visit: (entry: Visit) => void, path: (string | number)[] = ["nodes"]) {
  const step = (list: readonly LooseNode[], base: (string | number)[], ancestors: LooseNode[]) => {
    list.forEach((node, index) => {
      const nodePath = [...base, index]
      visit({ node, path: nodePath, parent: ancestors[ancestors.length - 1], ancestors })
      const next = [...ancestors, node]
      if (Array.isArray(node.children)) step(node.children, [...nodePath, "children"], next)
      const props = node.props as { items?: { nodes?: LooseNode[] }[] } | undefined
      if ((node.type === "tabs" || node.type === "accordion") && Array.isArray(props?.items)) {
        props.items.forEach((item, itemIndex) => {
          if (Array.isArray(item.nodes)) step(item.nodes, [...nodePath, "props", "items", itemIndex, "nodes"], next)
        })
      }
    })
  }
  step(nodes, path, [])
}

const MOCKUP_BANNED = new Set(["claim-tree", "claim", "decision", "mockup", "state-machine"])

function collectIds(nodes: readonly LooseNode[]): string[] {
  const ids: string[] = []
  walkPlanNodes(nodes, ({ node }) => {
    if (node.metadata?.id) ids.push(node.metadata.id)
  })
  return ids
}

export function lintPlanSpec(nodes: readonly LooseNode[], ctx: Ctx) {
  const callRowIds = new Set<string>()
  const decisionPaths = new Map<string, string>()
  let decisionCount = 0
  let treeCount = 0
  const claimRefs: { ref: string; path: (string | number)[] }[] = []

  walkPlanNodes(nodes, ({ node, path, parent, ancestors }) => {
    const props = (node.props ?? {}) as Record<string, unknown>
    const where = path.join(".")

    if (node.type === "call-stack" && Array.isArray(props.rows)) {
      for (const id of callStackRowIds(props as { rows: unknown[] })) callRowIds.add(id)
    }

    if (node.type === "decision" && typeof props.id === "string") {
      decisionCount++
      const previous = decisionPaths.get(props.id)
      if (previous) report(ctx, [...path, "props", "id"], `decision "${props.id}" is declared twice (${previous}, ${where})`)
      else decisionPaths.set(props.id, where)
      if (decisionCount === MAX_DECISIONS_PER_SPEC + 1) {
        report(ctx, path, `a spec may hold at most ${MAX_DECISIONS_PER_SPEC} decisions; fold the rest into claims or comments`)
      }
    }

    if (node.type === "claim-tree") {
      treeCount++
      if (treeCount > 1) report(ctx, path, "claim-tree may appear at most once per spec")
      node.children?.forEach((child, index) => {
        if (child.type !== "claim") report(ctx, [...path, "children", index], `claim-tree children must be claims (got ${child.type})`)
      })
    }

    if (node.type === "claim") {
      if (!parent || (parent.type !== "claim-tree" && parent.type !== "claim")) {
        report(ctx, path, "a claim must sit inside a claim-tree or another claim")
      }
      const depth = ancestors.filter((ancestor) => ancestor.type === "claim").length + 1
      if (depth > MAX_CLAIM_DEPTH) report(ctx, path, `claims nest at most ${MAX_CLAIM_DEPTH} levels deep`)
      const children = node.children ?? []
      const label = typeof props.text === "string" ? `"${props.text.slice(0, 40)}"` : where
      if (children[0] && (children[0].type === "claim" || children[0].type === "decision")) {
        report(ctx, [...path, "children", 0], `claim ${label}: put the exhibit first, then at most one decision or alert, then child claims`)
      } else {
        let index = 1
        if (children[index] && (children[index].type === "decision" || children[index].type === "alert")) index++
        for (; index < children.length; index++) {
          if (children[index].type !== "claim") {
            report(ctx, [...path, "children", index], `claim ${label}: put the exhibit first, then at most one decision or alert, then child claims`)
            break
          }
        }
      }
      if (typeof props.ref === "string") claimRefs.push({ ref: props.ref, path: [...path, "props", "ref"] })
    }

    if (node.type === "wireframe") {
      const mockups = ancestors.filter((ancestor) => ancestor.type === "mockup")
      if (mockups.length === 0) report(ctx, path, "wireframe must sit inside a mockup")
      const element = props.element
      if ((element === "prompt" || element === "output")) {
        const nearest = mockups[mockups.length - 1]
        if (!nearest || (nearest.props as { frame?: string } | undefined)?.frame !== "terminal") {
          report(ctx, path, `wireframe ${element} needs a mockup with frame "terminal"`)
        }
      }
    }

    if (node.type === "mockup") {
      const inside = node.children ?? []
      walkPlanNodes(inside, ({ node: descendant, path: rel }) => {
        if (MOCKUP_BANNED.has(descendant.type)) {
          report(ctx, [...path, "children", ...rel.slice(1)], `mockup cannot contain ${descendant.type}`)
        }
      }, [])
      const ids = collectIds(inside)
      const seen = new Set<string>()
      for (const id of ids) {
        if (seen.has(id)) report(ctx, path, `mockup: metadata.id "${id}" is used twice inside this mockup`)
        seen.add(id)
      }
      const pins = (props.pins ?? []) as { target?: string }[]
      pins.forEach((pin, index) => {
        if (pin.target && !seen.has(pin.target)) {
          report(ctx, [...path, "props", "pins", index, "target"], `mockup pin ${index + 1}: target "${pin.target}" is not a node inside this mockup`)
        }
      })
    }

    if (node.type === "state-machine") {
      const childIds = new Map<string, number>()
      ;(node.children ?? []).forEach((child, index) => {
        const id = child.metadata?.id
        if (!id) {
          report(ctx, [...path, "children", index], "state-machine screen children need metadata.id so a state can point at them")
          return
        }
        if (childIds.has(id)) report(ctx, [...path, "children", index], `state-machine: screen id "${id}" is used twice`)
        childIds.set(id, index)
      })
      const states = (props.states ?? []) as { id: string; screen?: string }[]
      const used = new Set<string>()
      states.forEach((state, index) => {
        if (!state.screen) return
        used.add(state.screen)
        if (!childIds.has(state.screen)) {
          report(ctx, [...path, "props", "states", index, "screen"], `state "${state.id}": screen "${state.screen}" is not a direct child of this machine`)
        }
      })
      for (const [id, index] of childIds) {
        if (!used.has(id)) report(ctx, [...path, "children", index], `state-machine: screen "${id}" is not used by any state`)
      }
    }
  })

  for (const { ref, path } of claimRefs) {
    if (!callRowIds.has(ref)) report(ctx, path, `claim ref "${ref}" matches no call-stack row id`)
  }
}

// ---------------------------------------------------------------------------
// file-tree notes (improved)
// ---------------------------------------------------------------------------

type TreeItem = { name: string; children?: TreeItem[] }

export function flattenFileTreePaths(items: readonly TreeItem[], prefix = ""): string[] {
  return items.flatMap((item) => {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    return [path, ...(item.children ? flattenFileTreePaths(item.children, path) : [])]
  })
}
