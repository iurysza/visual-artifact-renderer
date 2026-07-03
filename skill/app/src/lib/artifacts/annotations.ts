import { parseAnnotationAuthor, parseAnnotationDocument } from "@agents/visual-artifact-annotations"
import { artifactAnnotationsUrl, artifactAnnotationsApiUrl, artifactAnnotationsAuthorUrl } from "./paths"

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

export async function resolveLocalAuthor(): Promise<AnnotationAuthor> {
  const response = await fetch(artifactAnnotationsAuthorUrl())
  if (!response.ok) {
    throw new Error(`Failed to load author: ${response.status}`)
  }
  const raw = await response.json()
  return parseAnnotationAuthor(raw)
}

export async function postAnnotationMutations(
  project: string,
  slug: string,
  mutations: AnnotationMutations,
): Promise<AnnotationDocument> {
  const response = await fetch(artifactAnnotationsApiUrl(project, slug), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mutations),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Failed to save annotations (${response.status})`)
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
