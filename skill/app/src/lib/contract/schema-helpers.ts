import { z } from "zod"

const metadataSchema = z
  .object({
    id: z.string().min(1).optional(),
  })
  .strict()
  .optional()

export function leafSchema<T extends string, S extends z.ZodRawShape>(
  type: T,
  shape: S
) {
  return z
    .object({
      type: z.literal(type),
      props: z.object(shape).strict(),
      metadata: metadataSchema,
    })
    .strict()
}

export function optionalPropsSchema<T extends string, S extends z.ZodRawShape>(
  type: T,
  shape: S
) {
  return z
    .object({
      type: z.literal(type),
      props: z.object(shape).strict().optional(),
      metadata: metadataSchema,
    })
    .strict()
}

export function containerSchema<
  T extends string,
  S extends z.ZodRawShape,
  C extends z.ZodType<unknown>,
>(type: T, shape: S, children: C) {
  return z
    .object({
      type: z.literal(type),
      props: z.object(shape).strict().optional(),
      children,
      metadata: metadataSchema,
    })
    .strict()
}
