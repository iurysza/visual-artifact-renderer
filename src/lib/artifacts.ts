import { promises as fs } from "fs"
import path from "path"

import { ArtifactSlugSchema, VisualArtifactSpecSchema, type VisualArtifactSpec } from "@/lib/artifact-schema"

const ARTIFACTS_DIR = path.join(process.cwd(), "src", "artifacts")

export async function getVisualArtifactSpec(slug: string): Promise<VisualArtifactSpec | null> {
  const parsedSlug = ArtifactSlugSchema.safeParse(slug)

  if (!parsedSlug.success) {
    return null
  }

  const filePath = path.join(ARTIFACTS_DIR, `${parsedSlug.data}.json`)

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
