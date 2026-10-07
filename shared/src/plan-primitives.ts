// Plan-node primitives shared by the schema and the terse parsers.
// Kept in their own module so terse/* can import them without a cycle.
import { z } from "zod"

export const PLAN_ID_RE = /^[A-Za-z0-9][\w.-]{0,63}$/
export const PlanIdSchema = z.string().regex(PLAN_ID_RE)
export const ChangeMarkSchema = z.enum(["added", "removed", "changed", "proposed", "context"])
export const ShortLabel = (max: number) => z.string().min(1).max(max)
// "path/file.ts:12-30"
export const SOURCE_REF_RE = /^[\w./@-]+(?::\d+(?:-\d+)?)?$/
export const SourceRefSchema = z.string().regex(SOURCE_REF_RE).max(200)
// "| a | b | . |" or ["a", "b", null]
export const GridRowSchema = z.union([
  z.string().regex(/^\|.*\|$/).max(200),
  z.array(PlanIdSchema.nullable()).max(6),
])
export type ChangeMark = z.infer<typeof ChangeMarkSchema>
export type GridRow = z.infer<typeof GridRowSchema>
