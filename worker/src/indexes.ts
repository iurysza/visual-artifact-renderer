import { ARTIFACT_TYPES, type ArtifactType } from "@agents/visual-artifact-annotations/contract"

export interface ArtifactListing {
  slug: string
  title: string
  description?: string
  artifactType?: ArtifactType
  topics?: string[]
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
  artifacts: RecentArtifact[]
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

  const artifacts = await buildRecentArtifacts(bucket)
  return { projects: projectList, recent: artifacts.slice(0, 6), artifacts }
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
    const metadata = await readArtifactMetadata(bucket, project, slug)
    artifactList.push({
      slug,
      title: metadata.title ?? slug,
      description: metadata.description,
      artifactType: metadata.artifactType,
      topics: metadata.topics,
      modifiedAt: modifiedAt.toISOString(),
    })
  }

  return {
    project,
    artifacts: artifactList.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
  }
}

async function buildRecentArtifacts(bucket: R2Bucket, limit = 100): Promise<RecentArtifact[]> {
  const list = await bucket.list({ prefix: BUNDLE_PREFIX })
  const artifactObjects = list.objects
    .map((object) => ({ object, parsed: parseBundleKey(object.key) }))
    .filter(({ parsed }) => parsed?.filename === ARTIFACT_FILE)
    .sort((a, b) => b.object.uploaded.getTime() - a.object.uploaded.getTime())
    .slice(0, limit)

  return Promise.all(artifactObjects.map(async ({ object, parsed }) => {
    const metadata = await readArtifactMetadata(bucket, parsed!.project, parsed!.slug)
    return {
      project: parsed!.project,
      slug: parsed!.slug,
      title: metadata.title ?? parsed!.slug,
      description: metadata.description,
      artifactType: metadata.artifactType,
      topics: metadata.topics,
      modifiedAt: object.uploaded.toISOString(),
    }
  }))
}

interface ArtifactMetadata {
  title?: string
  description?: string
  artifactType?: ArtifactType
  topics?: string[]
}

function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === "string" && ARTIFACT_TYPES.some((type) => type === value)
}

async function readArtifactMetadata(bucket: R2Bucket, project: string, slug: string): Promise<ArtifactMetadata> {
  const key = `${BUNDLE_PREFIX}${project}/${slug}/${ARTIFACT_FILE}`
  try {
    const object = await bucket.get(key)
    if (!object) return {}
    const parsed = JSON.parse(await object.text()) as Record<string, unknown>
    return {
      title: typeof parsed.title === "string" && parsed.title.length > 0 ? parsed.title : undefined,
      description: typeof parsed.description === "string" && parsed.description.length > 0 ? parsed.description : undefined,
      artifactType: isArtifactType(parsed.artifactType) ? parsed.artifactType : undefined,
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter((topic): topic is string => typeof topic === "string" && topic.length > 0)
        : undefined,
    }
  } catch {
    return {}
  }
}
