import { promises as fs } from "fs"
import path from "path"

import { VisualArtifactSpecSchema, type VisualArtifactSpec } from "@/lib/artifact-schema"

const ARTIFACTS_DIR = path.join(process.cwd(), "src", "artifacts")
const DEFAULT_BASE_URL = "http://localhost:9999"

export type CreateVisualArtifactResult = {
  slug: string
  path: string
  url: string
}

export async function createVisualArtifact(
  input: VisualArtifactSpec
): Promise<CreateVisualArtifactResult> {
  const spec = VisualArtifactSpecSchema.parse(input)
  const filePath = path.join(ARTIFACTS_DIR, `${spec.slug}.json`)

  await fs.mkdir(ARTIFACTS_DIR, { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(spec, null, 2)}\n`)

  return {
    slug: spec.slug,
    path: filePath,
    url: `${process.env.VISUAL_ARTIFACT_BASE_URL ?? DEFAULT_BASE_URL}/artifacts/${spec.slug}`,
  }
}
