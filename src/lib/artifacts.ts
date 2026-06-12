import { promises as fs } from "fs"
import os from "os"
import path from "path"

import { ArtifactSlugSchema, VisualArtifactSpecSchema, type VisualArtifactSpec } from "@/lib/artifact-schema"

const ARTIFACTS_DIR = path.join(os.homedir(), ".pi", "artifacts")

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

export async function listProjects(): Promise<ProjectListing[]> {
  try {
    const entries = await fs.readdir(ARTIFACTS_DIR, { withFileTypes: true })
    const projects: ProjectListing[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const projectDir = path.join(ARTIFACTS_DIR, entry.name)
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
      const parsed = VisualArtifactSpecSchema.safeParse(JSON.parse(raw))

      artifacts.push({
        slug: parsedSlug.data,
        title: parsed.success ? parsed.data.title : slug,
        description: parsed.success ? parsed.data.description : undefined,
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
    return VisualArtifactSpecSchema.parse(JSON.parse(file))
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }

    throw error
  }
}

function isMissingFileError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
  )
}
