import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { BUNDLE_FILES } from "./paths.ts"
import { fileExists, isKebabCase } from "../util.ts"

export interface ArtifactMeta {
  title?: string
  description?: string
}

export interface ProjectIndexEntry {
  name: string
  artifactCount: number
  lastModifiedAt: string
}

export interface ArtifactIndexEntry {
  slug: string
  title?: string
  description?: string
  modifiedAt: string
  project: string
}

export interface ArtifactListEntry {
  slug: string
  title?: string
  description?: string
  modifiedAt: string
}

export async function readArtifactMeta(filePath: string): Promise<ArtifactMeta> {
  try {
    const raw = await readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    return {
      title: typeof parsed.title === "string" && parsed.title.length > 0 ? parsed.title : undefined,
      description: typeof parsed.description === "string" && parsed.description.length > 0 ? parsed.description : undefined,
    }
  } catch {
    return {}
  }
}

/**
 * List artifacts in a project directory using the bundle layout.
 *
 * Each immediate child directory that contains an `artifact.json` file is
 * treated as one artifact. Flat `<slug>.json` files are ignored.
 */
export async function listProjectArtifacts(projectDir: string): Promise<ArtifactListEntry[]> {
  const artifacts: ArtifactListEntry[] = []
  try {
    const entries = await readdir(projectDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const slug = entry.name
      if (!isKebabCase(slug)) continue
      const artifactJson = join(projectDir, slug, BUNDLE_FILES.artifact)
      if (!(await fileExists(artifactJson))) continue
      const stats = await stat(artifactJson)
      const meta = await readArtifactMeta(artifactJson)
      artifacts.push({ slug, title: meta.title, description: meta.description, modifiedAt: stats.mtime.toISOString() })
    }
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error
  }
  artifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
  return artifacts
}

/**
 * Scan the entire artifacts directory for projects and artifacts.
 */
export async function scanArtifacts(
  artifactsDir: string,
): Promise<{ projects: ProjectIndexEntry[]; artifacts: ArtifactIndexEntry[] }> {
  const projects: ProjectIndexEntry[] = []
  const allArtifacts: ArtifactIndexEntry[] = []

  try {
    const entries = await readdir(artifactsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const projectName = entry.name
      if (!isKebabCase(projectName)) continue
      const projectDir = join(artifactsDir, projectName)
      const projectArtifacts = await listProjectArtifacts(projectDir)
      if (projectArtifacts.length === 0) continue

      projects.push({
        name: projectName,
        artifactCount: projectArtifacts.length,
        lastModifiedAt: projectArtifacts[0].modifiedAt,
      })
      allArtifacts.push(...projectArtifacts.map((artifact) => ({ ...artifact, project: projectName })))
    }
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error
  }

  projects.sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime())
  allArtifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())

  return { projects, artifacts: allArtifacts }
}
