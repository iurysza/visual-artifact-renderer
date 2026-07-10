import { loadConfig } from "../config.ts"
import type { Logger } from "../logger.ts"
import { validateSpec, ValidationError } from "../validate.ts"
import { validateMermaidNodes } from "../mermaid.ts"
import { readStdinOrFile } from "../util.ts"
import type { GlobalOpts } from "../types.ts"

interface ValidateOpts extends GlobalOpts {}

export async function validate(inputPath: string | undefined, opts: ValidateOpts, log: Logger): Promise<number> {
  let raw: string
  try {
    raw = await readStdinOrFile(inputPath)
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error))
    return 2
  }

  let specJson: unknown
  try {
    specJson = JSON.parse(raw)
  } catch (error) {
    log.error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }

  try {
    loadConfig()
    const spec = validateSpec(specJson)

    // Validate Mermaid diagram content so `validate` reports the same broken
    // graphs that `create` would reject.
    await validateMermaidNodes(spec)

    log.output({
      ok: true,
      slug: spec.slug,
      title: spec.title,
      nodeCount: spec.nodes.length,
      dataKeys: spec.data ? Object.keys(spec.data) : undefined,
    })
    return 0
  } catch (error) {
    if (error instanceof ValidationError) {
      log.error(`Validation failed: ${error.message}`)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
