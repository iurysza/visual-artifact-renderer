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

export const ReportPacketCodeSnippetSchema = z
  .object({
    title: z.string().min(1),
    language: z.string().min(1).optional(),
    code: z.string().min(1),
    path: z.string().min(1).optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    description: z.string().min(1).optional(),
  })
  .strict()

export const VisualArtifactReportPacketSchema = z
  .object({
    id: z.string().min(1),
    kind: ReportPacketKindSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    facts: z.record(z.string(), z.unknown()).default({}),
    findings: z.array(ReportPacketFindingSchema).default([]),
    dataPatches: z.record(z.string(), z.array(z.unknown())).optional(),
    assets: z.array(ReportPacketAssetSchema).default([]),
    codeSnippets: z.array(ReportPacketCodeSnippetSchema).default([]),
    unresolvedQuestions: z.array(z.string().min(1)).optional(),
  })
  .strict()

export type ReportPacketKind = z.infer<typeof ReportPacketKindSchema>
export type ReportPacketFinding = z.infer<typeof ReportPacketFindingSchema>
export type ReportPacketAsset = z.infer<typeof ReportPacketAssetSchema>
export type ReportPacketCodeSnippet = z.infer<typeof ReportPacketCodeSnippetSchema>
export type VisualArtifactReportPacket = z.infer<typeof VisualArtifactReportPacketSchema>
export type VisualArtifactReportPacketInput = z.input<typeof VisualArtifactReportPacketSchema>

export function parseReportPacket(value: unknown): VisualArtifactReportPacket {
  return VisualArtifactReportPacketSchema.parse(value)
}

export function safeParseReportPacket(value: unknown) {
  return VisualArtifactReportPacketSchema.safeParse(value)
}
