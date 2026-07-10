import { ConfigValidationError, loadConfig } from "../config.ts"
import { preflightArtifactSpec } from "@agents/visual-artifact-annotations/contract"
import type { Logger, ResultData } from "../logger.ts"
import { validateSpec, ValidationError } from "../validate.ts"
import { validateMermaidNodes } from "../mermaid.ts"
import { readStdinOrFile } from "../util.ts"
import type { GlobalOpts } from "../types.ts"

interface ValidateOpts extends GlobalOpts {}

export async function validate(inputPath: string | undefined, opts: ValidateOpts, log: Logger): Promise<number> {
  try {
    loadConfig({
      overrides: opts.allowRemote !== undefined ? { allowRemote: opts.allowRemote } : undefined,
    })
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }

  let raw: string
  try {
    raw = await readStdinOrFile(inputPath)
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error), error)
    return 2
  }

  let specJson: unknown
  try {
    specJson = JSON.parse(raw)
  } catch (error) {
    log.error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`, error)
    return 2
  }

  try {
    const spec = validateSpec(specJson)

    // Validate Mermaid diagram content so `validate` reports the same broken
    // graphs that `create` would reject.
    await validateMermaidNodes(spec)

    const { result: preflight } = preflightArtifactSpec(specJson)

    const result: ResultData = {
      command: "validate",
      ok: true,
      slug: spec.slug,
      title: spec.title,
      totalNodes: preflight.totalNodes,
      datasetCount: spec.data ? Object.keys(spec.data).length : 0,
    }
    log.result(result)
    return 0
  } catch (error) {
    if (error instanceof ValidationError) {
      log.error(`Validation failed: ${error.message}`)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }
}
