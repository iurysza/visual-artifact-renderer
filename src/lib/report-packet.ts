import { z } from "zod"

export const ReportPacketKindSchema = z.enum([
  "repo-profile",
  "folder-layers",
  "dependency-graph",
  "codebase-orientation",
  "important-components",
  "hotspot-audit",
  "change-scenario-trace",
  "boundary-audit",
  "testability-audit",
  "knowledge-duplication-audit",
  "side-effect-map",
  "abstraction-usefulness-audit",
  "recommendations",
])

export const ReportPacketFindingSchema = z
  .object({
    title: z.string().min(1),
    evidence: z.array(z.string().min(1)),
    whyItMatters: z.string().min(1),
    changeRisk: z.enum(["low", "medium", "high"]).optional(),
    testCoverage: z.string().min(1).optional(),
    suggestedNextStep: z.string().min(1).optional(),
    confidence: z.enum(["low", "medium", "high"]),
  })
  .strict()

export const ReportPacketAssetSchema = z
  .object({
    type: z.enum(["mermaid", "json", "text", "table"]),
    path: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1).optional(),
  })
  .strict()

export const ReportPacketAssemblyHintSchema = z
  .object({
    section: z.string().min(1),
    suggestedNodeTypes: z.array(z.string().min(1)),
    priority: z.enum(["primary", "secondary"]),
  })
  .strict()

export const VisualArtifactReportPacketSchema = z
  .object({
    id: z.string().min(1),
    kind: ReportPacketKindSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    instructionsSource: z.array(z.string().min(1)),
    facts: z.record(z.unknown()).default({}),
    findings: z.array(ReportPacketFindingSchema).default([]),
    dataPatches: z.record(z.array(z.unknown())).optional(),
    assets: z.array(ReportPacketAssetSchema).default([]),
    assemblyHints: z.array(ReportPacketAssemblyHintSchema).default([]),
    unresolvedQuestions: z.array(z.string().min(1)).optional(),
  })
  .strict()

export type ReportPacketKind = z.infer<typeof ReportPacketKindSchema>
export type ReportPacketFinding = z.infer<typeof ReportPacketFindingSchema>
export type ReportPacketAsset = z.infer<typeof ReportPacketAssetSchema>
export type ReportPacketAssemblyHint = z.infer<typeof ReportPacketAssemblyHintSchema>
export type VisualArtifactReportPacket = z.infer<typeof VisualArtifactReportPacketSchema>

export function parseReportPacket(value: unknown): VisualArtifactReportPacket {
  return VisualArtifactReportPacketSchema.parse(value)
}

export function safeParseReportPacket(value: unknown) {
  return VisualArtifactReportPacketSchema.safeParse(value)
}
