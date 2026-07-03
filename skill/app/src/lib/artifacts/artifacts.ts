import { promises as fs } from "fs"
import path from "path"

import { ArtifactSlugSchema, VisualArtifactSpecSchema, type VisualArtifactSpec } from "@/lib/contract/artifact-schema"

const ARTIFACTS_DIR = process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
  ? path.resolve(process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR)
  : path.resolve(process.cwd(), "..", "artifacts")

export interface ProjectListing {
  name: string
  artifactCount: number
  lastModifiedAt: Date
}

export interface ArtifactListing {
  slug: string
  title: string
  description?: string
  modifiedAt: Date
}

export interface RecentArtifact extends ArtifactListing {
  project: string
}

export async function listProjects(): Promise<ProjectListing[]> {
  try {
    const entries = await fs.readdir(ARTIFACTS_DIR, { withFileTypes: true })
    const projects: ProjectListing[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const artifacts = await listArtifactsInProject(entry.name)

      if (artifacts.length === 0) continue

      const lastModifiedAt = artifacts.reduce((latest, artifact) => {
        return artifact.modifiedAt > latest ? artifact.modifiedAt : latest
      }, artifacts[0].modifiedAt)

      projects.push({
        name: entry.name,
        artifactCount: artifacts.length,
        lastModifiedAt,
      })
    }

    return projects.sort((a, b) => b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime())
  } catch (error) {
    if (isMissingFileError(error)) return []
    throw error
  }
}

export async function listArtifactsInProject(projectName: string): Promise<ArtifactListing[]> {
  const projectDir = path.join(ARTIFACTS_DIR, projectName)

  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true })
    const artifacts: ArtifactListing[] = []

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue

      const slug = entry.name.replace(/\.json$/, "")
      const parsedSlug = ArtifactSlugSchema.safeParse(slug)
      if (!parsedSlug.success) continue

      const filePath = path.join(projectDir, entry.name)
      const stats = await fs.stat(filePath)
      const raw = await fs.readFile(filePath, "utf8")
      let title = slug
      let description: string | undefined

      try {
        const parsed = VisualArtifactSpecSchema.safeParse(JSON.parse(raw))
        if (parsed.success) {
          title = parsed.data.title
          description = parsed.data.description
        }
      } catch {
        // Invalid local artifact JSON should not take down the index page.
      }

      artifacts.push({
        slug: parsedSlug.data,
        title,
        description,
        modifiedAt: stats.mtime,
      })
    }

    return artifacts.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
  } catch (error) {
    if (isMissingFileError(error)) {
      return []
    }
    throw error
  }
}

export async function getVisualArtifactSpec(projectName: string, slug: string): Promise<VisualArtifactSpec | null> {
  const parsedProject = ArtifactSlugSchema.safeParse(projectName)
  const parsedSlug = ArtifactSlugSchema.safeParse(slug)

  if (!parsedProject.success || !parsedSlug.success) {
    return null
  }

  const filePath = path.join(ARTIFACTS_DIR, parsedProject.data, `${parsedSlug.data}.json`)

  try {
    const file = await fs.readFile(filePath, "utf8")
    const parsed = VisualArtifactSpecSchema.safeParse(JSON.parse(file))
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return null
    }

    throw error
  }
}

export async function listRecentArtifacts(limit = 6): Promise<RecentArtifact[]> {
  const projects = await listProjects()
  const recent: RecentArtifact[] = []

  for (const project of projects) {
    const artifacts = await listArtifactsInProject(project.name)
    for (const artifact of artifacts) {
      recent.push({ ...artifact, project: project.name })
    }
  }

  return recent
    .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
    .slice(0, limit)
}

function isMissingFileError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
  )
}
