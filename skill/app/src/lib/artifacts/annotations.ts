import { parseAnnotationDocument } from "@agents/visual-artifact-annotations"
import { artifactAnnotationsUrl } from "./paths"

import type {
  AnnotationAnchor,
  AnnotationAuthor,
  AnnotationDocument,
  AnnotationMessage,
  AnnotationMutation,
  AnnotationMutations,
  AnnotationThread,
  AnnotationThreadStatus,
} from "@agents/visual-artifact-annotations"

export async function loadAnnotationDocument(project: string, slug: string): Promise<AnnotationDocument> {
  const response = await fetch(artifactAnnotationsUrl(project, slug))
  if (!response.ok) {
    throw new Error(`Failed to load annotations for ${project}/${slug}: ${response.status}`)
  }
  const raw = await response.json()
  return parseAnnotationDocument(raw)
}

export type {
  AnnotationAnchor,
  AnnotationAuthor,
  AnnotationDocument,
  AnnotationMessage,
  AnnotationMutation,
  AnnotationMutations,
  AnnotationThread,
  AnnotationThreadStatus,
}
