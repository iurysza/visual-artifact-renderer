const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isKebabCase(value: string): boolean {
  return KEBAB_RE.test(value)
}

export function isSafeAssetPath(value: string): boolean {
  if (value === "" || value.startsWith("/") || value.includes("..") || value.includes("//")) {
    return false
  }
  return value.split("/").every((segment) => segment !== "" && !segment.includes("\\"))
}

export interface ParsedArtifactPath {
  project: string
  slug: string
}

export function parseArtifactPath(segments: string[]): ParsedArtifactPath | null {
  if (segments.length !== 2) return null
  const [project, slug] = segments
  if (!isKebabCase(project) || !isKebabCase(slug)) return null
  return { project, slug }
}

export interface ParsedProjectPath {
  project: string
}

export function parseProjectPath(segments: string[]): ParsedProjectPath | null {
  if (segments.length !== 1) return null
  const [project] = segments
  if (!isKebabCase(project)) return null
  return { project }
}
