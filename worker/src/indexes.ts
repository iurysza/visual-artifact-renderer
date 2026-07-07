export interface ArtifactListing {
  slug: string
  title: string
  description?: string
  modifiedAt: string
}

export interface ProjectListing {
  name: string
  artifactCount: number
  lastModifiedAt: string
}

export interface HomeIndex {
  projects: ProjectListing[]
  recent: RecentArtifact[]
}

export interface RecentArtifact {
  slug: string
  title: string
  description?: string
  modifiedAt: string
  project: string
}

export interface ProjectIndex {
  project: string
  artifacts: ArtifactListing[]
}

const BUNDLE_PREFIX = "artifacts/"
const ARTIFACT_FILE = "artifact.json"

interface ParsedKey {
  project: string
  slug: string
  filename: string
}

function parseBundleKey(key: string): ParsedKey | null {
  if (!key.startsWith(BUNDLE_PREFIX)) return null
  const remainder = key.slice(BUNDLE_PREFIX.length)
  const segments = remainder.split("/")
  if (segments.length < 3) return null
  const [project, slug, filename, ...rest] = segments
  if (!project || !slug || !filename) return null
  if (rest.length > 0) return null
  return { project, slug, filename }
}

export async function buildHomeIndex(bucket: R2Bucket): Promise<HomeIndex> {
  const list = await bucket.list({ prefix: BUNDLE_PREFIX })
  const projects = new Map<string, { count: number; lastModified: Date }>()

  for (const object of list.objects) {
    const parsed = parseBundleKey(object.key)
    if (!parsed || parsed.filename !== ARTIFACT_FILE) continue
    const existing = projects.get(parsed.project)
    if (!existing || object.uploaded > existing.lastModified) {
      projects.set(parsed.project, { count: (existing?.count ?? 0) + 1, lastModified: object.uploaded })
    } else {
      existing.count += 1
    }
  }

  const projectList: ProjectListing[] = Array.from(projects.entries())
    .map(([name, { count, lastModified }]) => ({
      name,
      artifactCount: count,
      lastModifiedAt: lastModified.toISOString(),
    }))
    .sort((a, b) => b.lastModifiedAt.localeCompare(a.lastModifiedAt))

  const recent = await buildRecentArtifacts(bucket)
  return { projects: projectList, recent }
}

export async function buildProjectIndex(bucket: R2Bucket, project: string): Promise<ProjectIndex> {
  const prefix = `${BUNDLE_PREFIX}${project}/`
  const list = await bucket.list({ prefix })
  const artifacts = new Map<string, { modifiedAt: Date }>()

  for (const object of list.objects) {
    const parsed = parseBundleKey(object.key)
    if (!parsed || parsed.project !== project || parsed.filename !== ARTIFACT_FILE) continue
    const existing = artifacts.get(parsed.slug)
    if (!existing || object.uploaded > existing.modifiedAt) {
      artifacts.set(parsed.slug, { modifiedAt: object.uploaded })
    }
  }

  const artifactList: ArtifactListing[] = []
  for (const [slug, { modifiedAt }] of artifacts.entries()) {
    const title = await readArtifactTitle(bucket, project, slug)
    artifactList.push({
      slug,
      title: title ?? slug,
      modifiedAt: modifiedAt.toISOString(),
    })
  }

  return {
    project,
    artifacts: artifactList.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
  }
}

async function buildRecentArtifacts(bucket: R2Bucket, limit = 6): Promise<RecentArtifact[]> {
  const list = await bucket.list({ prefix: BUNDLE_PREFIX })
  const artifacts: RecentArtifact[] = []

  for (const object of list.objects) {
    const parsed = parseBundleKey(object.key)
    if (!parsed || parsed.filename !== ARTIFACT_FILE) continue
    const title = await readArtifactTitle(bucket, parsed.project, parsed.slug)
    artifacts.push({
      project: parsed.project,
      slug: parsed.slug,
      title: title ?? parsed.slug,
      modifiedAt: object.uploaded.toISOString(),
    })
  }

  return artifacts
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, limit)
}

async function readArtifactTitle(bucket: R2Bucket, project: string, slug: string): Promise<string | undefined> {
  const key = `${BUNDLE_PREFIX}${project}/${slug}/${ARTIFACT_FILE}`
  try {
    const object = await bucket.get(key)
    if (!object) return undefined
    const text = await object.text()
    const parsed = JSON.parse(text) as { title?: string; description?: string }
    return parsed.title
  } catch {
    return undefined
  }
}
