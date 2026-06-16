import { z } from "zod"

export function leafSchema<T extends string, S extends z.ZodRawShape>(
  type: T,
  shape: S
) {
  return z
    .object({
      type: z.literal(type),
      props: z.object(shape).strict(),
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
    })
    .strict()
}
