import { readdir, stat } from "node:fs/promises"
import { join, resolve } from "node:path"
import { loadConfig } from "../config.ts"
import type { Logger } from "../logger.ts"
import { dirExists } from "../util.ts"

const ROUTE_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function list(project: string | undefined, log: Logger): Promise<number> {
  const config = loadConfig()
  const artifactsDir = config.artifactsDir

  if (!(await dirExists(artifactsDir))) {
    log.output({ projects: [] })
    return 0
  }

  if (project) {
    const projectDir = resolve(artifactsDir, project)
    if (!projectDir.startsWith(resolve(artifactsDir) + "/")) {
      log.error("Invalid project name")
      return 2
    }
    if (!(await dirExists(projectDir))) {
      log.error(`Project not found: ${project}`)
      return 1
    }
    const artifacts = await readProjectArtifacts(projectDir)
    log.output({ project, artifacts })
    return 0
  }

  const projects: { name: string; artifactCount: number; lastModifiedAt?: string }[] = []
  const entries = await readdir(artifactsDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const projectDir = join(artifactsDir, entry.name)
    const artifacts = await readProjectArtifacts(projectDir)
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

  log.output({ projects })
  return 0
}

async function readProjectArtifacts(projectDir: string) {
  const artifacts: { slug: string; title?: string; description?: string; modifiedAt: string }[] = []
  try {
    const files = await readdir(projectDir, { withFileTypes: true })
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue
      const slug = file.name.replace(/\.json$/, "")
      if (!ROUTE_SEGMENT_RE.test(slug)) continue
      const filePath = join(projectDir, file.name)
      const stats = await stat(filePath)
      artifacts.push({ slug, modifiedAt: stats.mtime.toISOString() })
    }
  } catch {
    // ignore
  }
  artifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
  return artifacts
}
