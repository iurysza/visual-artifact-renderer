import { realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

import {
  MAX_AGGREGATE_FILE_SOURCE_BYTES,
  MAX_FILE_SOURCE_BYTES,
} from "@agents/visual-artifact-annotations/contract"

import type { Logger } from "../logger.ts"
import { readStdinOrFile } from "../util.ts"
import { ValidationError } from "../validate.ts"

export interface DiskSourceFileMeta {
  displayPath: string
  bytes: number
}

export interface SourceReadContext {
  projectRoot: string
  allowRoots: string[]
  log: Logger
  verbose: boolean
}

export interface SourceReadResult {
  content: string
  info: DiskSourceFileMeta & { canonicalPath: string }
  newAggregateBytes: number
}

export async function createSourceReadContext(
  projectPath: string,
  allowRead: string[],
  log: Logger,
  verbose: boolean,
): Promise<SourceReadContext> {
  let projectRoot: string
  try {
    projectRoot = await realpath(projectPath)
  } catch {
    throw new ValidationError(`Project path could not be resolved: ${projectPath}`)
  }
  const projectStat = await stat(projectRoot).catch(() => undefined)
  if (!projectStat?.isDirectory()) {
    throw new ValidationError(`Project path is not a directory: ${projectRoot}`)
  }

  const allowRoots: string[] = []
  for (const raw of allowRead) {
    if (hasDotDotSegment(raw)) {
      throw new ValidationError(`--allow-read path contains a .. segment: ${raw}`)
    }
    const candidate = resolve(raw)
    let canonicalRoot: string
    try {
      canonicalRoot = await realpath(candidate)
    } catch {
      throw new ValidationError(`--allow-read path could not be resolved: ${raw}`)
    }
    const rootStat = await stat(canonicalRoot).catch(() => undefined)
    if (!rootStat?.isDirectory()) {
      throw new ValidationError(`--allow-read path is not a directory: ${raw}`)
    }
    allowRoots.push(canonicalRoot)
  }

  if (verbose) {
    log.debug(`project root (canonical): ${projectRoot}`)
    if (allowRoots.length > 0) {
      log.debug(`authorized read roots:${allowRoots.map((root) => `\n  - ${root}`).join("")}`)
    }
  }

  return { projectRoot, allowRoots, log, verbose }
}

const SOURCE_LIMITS = {
  perFile: MAX_FILE_SOURCE_BYTES,
  aggregate: MAX_AGGREGATE_FILE_SOURCE_BYTES,
}

export function hasDotDotSegment(path: string): boolean {
  return path.split(/[/\\]+/).filter(Boolean).includes("..")
}

function isInside(child: string, parent: string): boolean {
  const pathFromParent = relative(parent, child)
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent))
  )
}

async function resolveSourcePath(
  src: string,
  projectRoot: string,
  allowRoots: string[],
): Promise<{ intendedRoot: string; canonicalPath: string }> {
  if (hasDotDotSegment(src)) {
    throw new ValidationError(`artifact source contains a .. segment: ${src}`)
  }

  const absolute = isAbsolute(src)
  const candidate = absolute ? resolve(src) : resolve(projectRoot, src)
  let canonicalPath: string
  try {
    canonicalPath = await realpath(candidate)
  } catch {
    throw new ValidationError(`artifact source could not be read: ${src}`)
  }

  const allowedRoots = absolute ? allowRoots : [projectRoot]
  const intendedRoot = allowedRoots
    .filter((root) => isInside(canonicalPath, root))
    .sort((left, right) => right.length - left.length)[0]
  if (!intendedRoot) {
    const reason = absolute
      ? "absolute artifact source is outside authorized read roots"
      : "relative artifact source escapes project root"
    throw new ValidationError(`${reason}: ${src}`)
  }

  return { intendedRoot, canonicalPath }
}

export async function readSourceFile(
  src: string,
  context: SourceReadContext,
  aggregateBytes = 0,
): Promise<SourceReadResult> {
  const { projectRoot, allowRoots, log, verbose } = context
  const { intendedRoot, canonicalPath } = await resolveSourcePath(src, projectRoot, allowRoots)

  let content: string
  try {
    content = await readStdinOrFile(canonicalPath, SOURCE_LIMITS.perFile)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (verbose) log.debug(`artifact source read failed at ${canonicalPath}: ${message}`)
    if (message.includes("larger than")) {
      throw new ValidationError(`artifact source exceeds ${SOURCE_LIMITS.perFile} bytes: ${src}`)
    }
    if (message.includes("not a regular file")) {
      throw new ValidationError(`artifact source is not a regular file: ${src}`)
    }
    throw new ValidationError(`artifact source could not be read: ${src}`)
  }

  const bytes = Buffer.byteLength(content, "utf8")
  if (aggregateBytes + bytes > SOURCE_LIMITS.aggregate) {
    throw new ValidationError(
      `artifact source aggregate bytes would exceed ${SOURCE_LIMITS.aggregate}: ${src} (${bytes} bytes; already ${aggregateBytes})`,
    )
  }

  if (verbose) log.debug(`artifact source canonical: ${canonicalPath}`)

  const displayPath = relative(intendedRoot, canonicalPath)
  return {
    content,
    info: { displayPath: displayPath || src, canonicalPath, bytes },
    newAggregateBytes: aggregateBytes + bytes,
  }
}
