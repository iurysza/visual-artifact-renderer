import { z } from "zod"

export const ANNOTATION_VERSION = 1 as const

export const AnnotationAuthorSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
  })
  .strict()

export type AnnotationAuthor = z.infer<typeof AnnotationAuthorSchema>

export const LOCAL_ANONYMOUS_AUTHOR: AnnotationAuthor = {
  name: "Local Author",
  email: "local-author@example.test",
}

export const AnnotationAnchorSchema = z
  .object({
    nodeId: z.string().min(1).optional(),
    nodePath: z.string().min(1),
    nodeType: z.string().min(1),
    textSnippet: z.string().min(1).optional(),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
  })
  .strict()

export type AnnotationAnchor = z.infer<typeof AnnotationAnchorSchema>

export const AnnotationThreadStatusSchema = z.enum(["open", "resolved"])

export type AnnotationThreadStatus = z.infer<typeof AnnotationThreadStatusSchema>

export const AnnotationMessageSchema = z
  .object({
    id: z.string().min(1),
    author: AnnotationAuthorSchema,
    body: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type AnnotationMessage = z.infer<typeof AnnotationMessageSchema>

export const AnnotationThreadSchema = z
  .object({
    id: z.string().min(1),
    anchor: AnnotationAnchorSchema,
    status: AnnotationThreadStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    messages: z.array(AnnotationMessageSchema).min(1),
  })
  .strict()

export type AnnotationThread = z.infer<typeof AnnotationThreadSchema>

export const AnnotationDocumentSchema = z
  .object({
    version: z.literal(ANNOTATION_VERSION),
    project: z.string().min(1),
    slug: z.string().min(1),
    threads: z.array(AnnotationThreadSchema),
  })
  .strict()

export type AnnotationDocument = z.infer<typeof AnnotationDocumentSchema>

const CreateThreadMutationSchema = z
  .object({
    type: z.literal("createThread"),
    thread: AnnotationThreadSchema,
  })
  .strict()

const AddMessageMutationSchema = z
  .object({
    type: z.literal("addMessage"),
    threadId: z.string().min(1),
    message: AnnotationMessageSchema,
  })
  .strict()

const ResolveThreadMutationSchema = z
  .object({
    type: z.literal("resolveThread"),
    threadId: z.string().min(1),
  })
  .strict()

const ReopenThreadMutationSchema = z
  .object({
    type: z.literal("reopenThread"),
    threadId: z.string().min(1),
  })
  .strict()

export const AnnotationMutationSchema = z.discriminatedUnion("type", [
  CreateThreadMutationSchema,
  AddMessageMutationSchema,
  ResolveThreadMutationSchema,
  ReopenThreadMutationSchema,
])

export type AnnotationMutation = z.infer<typeof AnnotationMutationSchema>

export const AnnotationMutationsSchema = z.array(AnnotationMutationSchema)

export type AnnotationMutations = z.infer<typeof AnnotationMutationsSchema>

export class AnnotationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AnnotationValidationError"
  }
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
}

export function parseAnnotationAuthor(input: unknown): AnnotationAuthor {
  const result = AnnotationAuthorSchema.safeParse(input)
  if (!result.success) {
    throw new AnnotationValidationError(formatZodError(result.error))
  }
  return result.data
}

export function parseAnnotationAnchor(input: unknown): AnnotationAnchor {
  const result = AnnotationAnchorSchema.safeParse(input)
  if (!result.success) {
    throw new AnnotationValidationError(formatZodError(result.error))
  }
  return result.data
}

export function parseAnnotationDocument(input: unknown): AnnotationDocument {
  const result = AnnotationDocumentSchema.safeParse(input)
  if (!result.success) {
    throw new AnnotationValidationError(formatZodError(result.error))
  }
  return result.data
}

export function parseAnnotationMutation(input: unknown): AnnotationMutation {
  const result = AnnotationMutationSchema.safeParse(input)
  if (!result.success) {
    throw new AnnotationValidationError(formatZodError(result.error))
  }
  return result.data
}

export function parseAnnotationMutations(input: unknown): AnnotationMutations {
  const result = AnnotationMutationsSchema.safeParse(input)
  if (!result.success) {
    throw new AnnotationValidationError(formatZodError(result.error))
  }
  return result.data
}

export function emptyAnnotationDocument(project: string, slug: string): AnnotationDocument {
  return {
    version: ANNOTATION_VERSION,
    project,
    slug,
    threads: [],
  }
}

export function buildAnnotationDocument(
  project: string,
  slug: string,
  threads: AnnotationThread[]
): AnnotationDocument {
  return {
    version: ANNOTATION_VERSION,
    project,
    slug,
    threads,
  }
}
