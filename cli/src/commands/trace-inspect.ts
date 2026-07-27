import { resolve } from "node:path"

import type { Logger, ResultData } from "../logger.ts"
import { createSourceReadContext, readSourceFile } from "../lib/source-files.ts"
import { extractSourceFacts, parseSourceAnchor } from "../source-facts.ts"
import type { GlobalOpts } from "../types.ts"
import { ValidationError } from "../validate.ts"

interface TraceInspectOpts extends GlobalOpts {
  project?: string
  anchor?: string[]
  allowRead?: string[]
}

export async function traceInspect(opts: TraceInspectOpts, log: Logger): Promise<number> {
  const anchors = opts.anchor ?? []
  if (anchors.length === 0) {
    log.error("trace inspect requires at least one --anchor <file:start[-end]>")
    return 2
  }

  try {
    const context = await createSourceReadContext(
      opts.project ?? resolve(process.cwd()),
      opts.allowRead ?? [],
      log,
      opts.verbose,
    )
    let aggregateBytes = 0
    const sources: unknown[] = []

    for (const rawAnchor of anchors) {
      const anchor = parseSourceAnchor(rawAnchor)
      const read = await readSourceFile(anchor.src, context, aggregateBytes)
      aggregateBytes = read.newAggregateBytes
      const result = extractSourceFacts({
        canonicalPath: read.info.canonicalPath,
        displayPath: read.info.displayPath,
        content: read.content,
        projectRoot: context.projectRoot,
        startLine: anchor.startLine,
        endLine: anchor.endLine,
      })
      if (result.resolution === "resolved") {
        sources.push({
          resolution: "resolved",
          source: { src: anchor.src, facts: result.facts },
        })
      } else {
        sources.push({
          resolution: "ambiguous",
          anchor,
          span: result.span,
          excerpt: result.excerpt,
          candidates: result.candidates,
        })
      }
    }

    const result: ResultData = {
      command: "trace inspect",
      ok: sources.every((source) => (source as { resolution: string }).resolution === "resolved"),
      projectRoot: context.projectRoot,
      sources,
    }
    log.result(result)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(message, error)
    return error instanceof ValidationError ? 2 : 1
  }
}
