import { format, isToday, isYesterday } from "date-fns"

import { ARTIFACT_TYPES, type ArtifactType } from "@/lib/contract/artifact-schema"

export { ARTIFACT_TYPES }
export type { ArtifactType }

/**
 * Project filter sentinel. Empty string is impossible for a valid kebab-case
 * project name (min length 1), so it cannot collide with a real project.
 */
export const ALL_PROJECTS_SENTINEL = ""

export interface ProjectListing {
  name: string
  artifactCount: number
  lastModifiedAt: string
}

export interface RecentArtifact {
  slug: string
  title: string
  description?: string
  artifactType?: ArtifactType
  topics?: string[]
  modifiedAt: string
  project: string
}

export interface ArtifactIndex {
  projects: ProjectListing[]
  recent: RecentArtifact[]
  artifacts?: RecentArtifact[]
}

export interface ArtifactFilters {
  query: string
  project: string
  artifactType: ArtifactType | "all"
}

export interface ArtifactDayGroup {
  key: string
  label: string
  artifacts: RecentArtifact[]
}

export function filterArtifacts(
  artifacts: RecentArtifact[],
  { query, project, artifactType }: ArtifactFilters,
): RecentArtifact[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return artifacts.filter((artifact) => {
    if (project !== ALL_PROJECTS_SENTINEL && artifact.project !== project) return false
    if (artifactType !== "all" && artifact.artifactType !== artifactType) return false
    if (!normalizedQuery) return true

    return [
      artifact.title,
      artifact.description,
      artifact.project,
      artifact.artifactType,
      ...(artifact.topics ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  })
}

export function groupArtifactsByDay(artifacts: RecentArtifact[]): ArtifactDayGroup[] {
  const sorted = [...artifacts].sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
  )
  const groups = new Map<string, RecentArtifact[]>()

  for (const artifact of sorted) {
    const date = new Date(artifact.modifiedAt)
    const key = format(date, "yyyy-MM-dd")
    const group = groups.get(key)
    if (group) group.push(artifact)
    else groups.set(key, [artifact])
  }

  return Array.from(groups, ([key, groupedArtifacts]) => {
    const date = new Date(groupedArtifacts[0].modifiedAt)
    const label = isToday(date)
      ? "Today"
      : isYesterday(date)
        ? "Yesterday"
        : format(date, "EEEE, MMM d")
    return { key, label, artifacts: groupedArtifacts }
  })
}
