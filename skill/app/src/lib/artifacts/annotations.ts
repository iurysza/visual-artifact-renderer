import { parseAnnotationDocument, type AnnotationDocument } from "@agents/visual-artifact-annotations"
import { artifactAnnotationsUrl } from "./paths"

export async function loadAnnotationDocument(project: string, slug: string): Promise<AnnotationDocument> {
  const response = await fetch(artifactAnnotationsUrl(project, slug))
  if (!response.ok) {
    throw new Error(`Failed to load annotations for ${project}/${slug}: ${response.status}`)
  }
  const raw = await response.json()
  return parseAnnotationDocument(raw)
}

export type { AnnotationDocument }
