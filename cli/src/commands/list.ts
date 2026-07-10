import { readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { ConfigValidationError, loadConfig } from "../config.ts"
import { isInsideArtifactsDir } from "../lib/paths.ts"
import { listProjectArtifacts } from "../lib/scan.ts"
import type { Logger, ResultData } from "../logger.ts"
import { dirExists } from "../util.ts"

export async function list(project: string | undefined, log: Logger): Promise<number> {
  let config
  try {
    config = loadConfig()
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }

  const artifactsDir = config.artifactsDir

  if (!(await dirExists(artifactsDir))) {
    const result: ResultData = { command: "list", projects: [] }
    log.result(result)
    return 0
  }

  if (project) {
    const projectDir = resolve(artifactsDir, project)
    if (!isInsideArtifactsDir(projectDir, artifactsDir)) {
      log.error("Invalid project name")
      return 2
    }
    if (!(await dirExists(projectDir))) {
      log.error(`Project not found: ${project}`)
      return 1
    }
    const artifacts = await listProjectArtifacts(projectDir)
    const result: ResultData = {
      command: "list",
      project,
      artifacts: artifacts.map((a) => ({
        project,
        slug: a.slug,
        title: a.title,
        modifiedAt: a.modifiedAt,
      })),
    }
    log.result(result)
    return 0
  }

  const projects: { name: string; artifactCount: number; lastModifiedAt?: string }[] = []
  const entries = await readdir(artifactsDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const projectDir = resolve(artifactsDir, entry.name)
    if (!isInsideArtifactsDir(projectDir, artifactsDir)) continue
    const artifacts = await listProjectArtifacts(projectDir)
    if (artifacts.length === 0) continue
    projects.push({
      name: entry.name,
      artifactCount: artifacts.length,
      lastModifiedAt: artifacts[0]?.modifiedAt,
    })
  }

  projects.sort((a, b) => {
    const aTime = a.lastModifiedAt ? new Date(a.lastModifiedAt).getTime() : 0
    const bTime = b.lastModifiedAt ? new Date(b.lastModifiedAt).getTime() : 0
    return bTime - aTime
  })

  const result: ResultData = { command: "list", projects }
  log.result(result)
  return 0
}

