import { z } from "zod"
import { ARTIFACT_NODE_TYPES } from "../contract/artifact-schema"

export const ReportDirectionArtifactTypeSchema = z.enum([
  "code-architecture",
  "explainer",
  "data-dashboard",
  "runbook",
])

export const ReportDirectionNodeTypeSchema = z.enum(ARTIFACT_NODE_TYPES)

export const ReportDirectionSectionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    purpose: z.string().min(1),
    readerQuestion: z.string().min(1),
    sourcePacketIds: z.array(z.string().min(1)).min(1),
    suggestedNodeTypes: z.array(ReportDirectionNodeTypeSchema).min(1),
    dataKeys: z.array(z.string().min(1)).optional(),
    codeSnippetIds: z.array(z.string().min(1)).optional(),
  })
  .strict()

export const ReportDirectionBriefSchema = z
  .object({
    id: z.string().min(1),
    thesis: z.string().min(1),
    intendedArtifact: ReportDirectionArtifactTypeSchema,
    audience: z.string().min(1),
    reportMode: z.literal("orientation-first"),
    emphasis: z.array(z.string().min(1)).min(1),
    sectionOrder: z.array(z.string().min(1)).min(1),
    sections: z.array(ReportDirectionSectionSchema).min(1),
    risksAndCaveats: z.array(z.string().min(1)).default([]),
    unresolvedQuestions: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((brief, ctx) => {
    const sectionIds = new Set(brief.sections.map((section) => section.id))
    const orderedIds = new Set(brief.sectionOrder)

    for (const sectionId of brief.sectionOrder) {
      if (!sectionIds.has(sectionId)) {
        ctx.addIssue({
          code: "custom",
          path: ["sectionOrder"],
          message: `sectionOrder references missing section: ${sectionId}`,
        })
      }
    }

    for (const section of brief.sections) {
      if (!orderedIds.has(section.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["sections", section.id],
          message: `section is missing from sectionOrder: ${section.id}`,
        })
      }
    }
  })

export type ReportDirectionArtifactType = z.infer<typeof ReportDirectionArtifactTypeSchema>
export type ReportDirectionNodeType = z.infer<typeof ReportDirectionNodeTypeSchema>
export type ReportDirectionSection = z.infer<typeof ReportDirectionSectionSchema>
export type ReportDirectionBrief = z.infer<typeof ReportDirectionBriefSchema>
export type ReportDirectionBriefInput = z.input<typeof ReportDirectionBriefSchema>

export function parseReportDirectionBrief(value: unknown): ReportDirectionBrief {
  return ReportDirectionBriefSchema.parse(value)
}

export function safeParseReportDirectionBrief(value: unknown) {
  return ReportDirectionBriefSchema.safeParse(value)
}
