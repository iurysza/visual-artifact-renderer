import type { z } from "zod"

import {
  parseVisualArtifactSpec,
  safeParseVisualArtifactSpec,
  type VisualArtifactSpec,
} from "@agents/visual-artifact-annotations/contract"

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

function humanPath(path: PropertyKey[]): string {
  if (path.length === 0) return "spec"

  let out = String(path[0])
  for (let i = 1; i < path.length; i++) {
    const segment = path[i]
    if (typeof segment === "number") {
      out += `[${segment}]`
    } else {
      out += `.${String(segment)}`
    }
  }
  return out
}

function formatIssue(issue: z.ZodIssue): string {
  return `${humanPath(issue.path)}: ${issue.message}`
}

function formatIssues(error: z.ZodError<unknown>): string {
  const seen = new Set<string>()
  const lines: string[] = []

  for (const issue of error.issues) {
    const line = formatIssue(issue)
    if (seen.has(line)) continue
    seen.add(line)
    lines.push(line)
  }

  return lines.join("\n")
}

/**
 * Validate an artifact spec using the shared executable schema.
 * Throws `ValidationError` with a human-readable, path-oriented message.
 */
export function validateSpec(spec: unknown): VisualArtifactSpec {
  const result = safeParseVisualArtifactSpec(spec)
  if (!result.success) {
    throw new ValidationError(formatIssues(result.error))
  }
  return result.data
}

/**
 * Throwing wrapper used by callers that already want an exception.
 */
export { parseVisualArtifactSpec }
