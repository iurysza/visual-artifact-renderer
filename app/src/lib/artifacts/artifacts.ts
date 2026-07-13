import { promises as fs } from "fs"
import { homedir } from "os"
import path from "path"

import {
  ArtifactSlugSchema,
  ArtifactValidationError,
  VisualArtifactSpecSchema,
  parseRawArtifactJson,
  type VisualArtifactSpec,
} from "@/lib/contract/artifact-schema"
import { readArtifactFileBounded } from "@/lib/artifacts/read-artifact-file"

const SKILL_ROOT = process.env.VISUAL_ARTIFACT_SKILL_ROOT
  ? path.resolve(process.env.VISUAL_ARTIFACT_SKILL_ROOT)
  : path.resolve(homedir(), ".agents", "skills", "visual-artifact")

const SHELL_ONLY_BUILD = process.env.NODE_ENV === "production" && !process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR

const ARTIFACTS_DIR = process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
  ? path.resolve(process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR)
  : path.resolve(SKILL_ROOT, "artifacts")

const ARTIFACT_JSON = "artifact.json"

function artifactBundleDir(projectName: string, slug: string): string {
  return path.join(ARTIFACTS_DIR, projectName, slug)
}

function artifactJsonPath(projectName: string, slug: string): string {
  return path.join(artifactBundleDir(projectName, slug), ARTIFACT_JSON)
}

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
  if (SHELL_ONLY_BUILD) return []
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
  if (SHELL_ONLY_BUILD) return []
  const projectDir = path.join(ARTIFACTS_DIR, projectName)

  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true })
    const artifacts: ArtifactListing[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const slug = entry.name
      const parsedSlug = ArtifactSlugSchema.safeParse(slug)
      if (!parsedSlug.success) continue

      const filePath = artifactJsonPath(projectName, parsedSlug.data)
      const stats = await fs.stat(filePath).catch(() => null)
      if (!stats) continue

      let title = slug
      let description: string | undefined

      try {
        const raw = await readArtifactFileBounded(filePath)
        const parsed = VisualArtifactSpecSchema.safeParse(parseRawArtifactJson(raw))
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
  if (SHELL_ONLY_BUILD) return null
  const parsedProject = ArtifactSlugSchema.safeParse(projectName)
  const parsedSlug = ArtifactSlugSchema.safeParse(slug)

  if (!parsedProject.success || !parsedSlug.success) {
    return null
  }

  const filePath = artifactJsonPath(parsedProject.data, parsedSlug.data)

  try {
    const file = await readArtifactFileBounded(filePath)
    const parsed = VisualArtifactSpecSchema.safeParse(parseRawArtifactJson(file))
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (isMissingFileError(error) || error instanceof ArtifactValidationError) {
      return null
    }

    throw error
  }
}

export async function listRecentArtifacts(limit = 6): Promise<RecentArtifact[]> {
  if (SHELL_ONLY_BUILD) return []
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
