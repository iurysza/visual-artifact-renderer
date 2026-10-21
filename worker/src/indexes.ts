import { ARTIFACT_TYPES, type ArtifactType } from "@agents/visual-artifact-annotations/contract"

export interface ArtifactListing {
  slug: string
  title: string
  description?: string
  artifactType?: ArtifactType
  topics?: string[]
  modifiedAt: string
  /** Open annotation threads. Always present so library qualifiers match the local index. */
  openThreads: number
  /** First message of the newest open thread, one line. */
  openExcerpt?: string
  /** True when publish.json says the bundle is published. */
  published: boolean
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
  openThreads: number
  openExcerpt?: string
  published: boolean
}

export interface ProjectIndex {
  project: string
  artifacts: ArtifactListing[]
}

const BUNDLE_PREFIX = "artifacts/"
const ARTIFACT_FILE = "artifact.json"
const ANNOTATIONS_FILE = "annotations.json"
const PUBLISH_FILE = "publish.json"
const EXCERPT_MAX = 80

interface BundleSignals {
  openThreads: number
  openExcerpt?: string
  published: boolean
}

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

async function listAll(bucket: R2Bucket, prefix: string): Promise<R2Object[]> {
  const objects: R2Object[] = []
  let cursor: string | undefined
  const seen = new Set<string>()
  for (;;) {
    const page = await bucket.list(cursor ? { prefix, cursor } : { prefix })
    objects.push(...page.objects)
    if (!page.truncated || !page.cursor || seen.has(page.cursor)) return objects
    seen.add(page.cursor)
    cursor = page.cursor
  }
}

export async function buildHomeIndex(bucket: R2Bucket): Promise<HomeIndex> {
  const objects = await listAll(bucket, BUNDLE_PREFIX)
  const projects = new Map<string, { count: number; lastModified: Date }>()

  for (const object of objects) {
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
  const objects = await listAll(bucket, `${BUNDLE_PREFIX}${project}/`)
  const artifacts = new Map<string, { modifiedAt: Date }>()

  for (const object of objects) {
    const parsed = parseBundleKey(object.key)
    if (!parsed || parsed.project !== project || parsed.filename !== ARTIFACT_FILE) continue
    const existing = artifacts.get(parsed.slug)
    if (!existing || object.uploaded > existing.modifiedAt) {
      artifacts.set(parsed.slug, { modifiedAt: object.uploaded })
    }
  }

  const keys = new Set(objects.map((object) => object.key))
  const artifactList: ArtifactListing[] = []
  for (const [slug, { modifiedAt }] of artifacts.entries()) {
    const metadata = await readArtifactMetadata(bucket, project, slug)
    const signals = await readBundleSignals(bucket, project, slug, keys)
    artifactList.push({
      slug,
      title: metadata.title ?? slug,
      description: metadata.description,
      artifactType: metadata.artifactType,
      topics: metadata.topics,
      modifiedAt: modifiedAt.toISOString(),
      ...signals,
    })
  }

  return {
    project,
    artifacts: artifactList.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
  }
}

async function buildRecentArtifacts(bucket: R2Bucket): Promise<RecentArtifact[]> {
  const objects = await listAll(bucket, BUNDLE_PREFIX)
  const keys = new Set(objects.map((object) => object.key))
  const artifactObjects = objects
    .map((object) => ({ object, parsed: parseBundleKey(object.key) }))
    .filter(({ parsed }) => parsed?.filename === ARTIFACT_FILE)
    .sort((a, b) => b.object.uploaded.getTime() - a.object.uploaded.getTime())

  return Promise.all(artifactObjects.map(async ({ object, parsed }) => {
    const metadata = await readArtifactMetadata(bucket, parsed!.project, parsed!.slug)
    const signals = await readBundleSignals(bucket, parsed!.project, parsed!.slug, keys)
    return {
      project: parsed!.project,
      slug: parsed!.slug,
      title: metadata.title ?? parsed!.slug,
      description: metadata.description,
      artifactType: metadata.artifactType,
      topics: metadata.topics,
      modifiedAt: object.uploaded.toISOString(),
      ...signals,
    }
  }))
}

async function readJson(bucket: R2Bucket, key: string): Promise<unknown> {
  try {
    const object = await bucket.get(key)
    if (!object) return undefined
    return JSON.parse(await object.text())
  } catch {
    return undefined
  }
}

/** Open comments and publish state. Missing or broken sidecars count as none. */
async function readBundleSignals(bucket: R2Bucket, project: string, slug: string, keys: Set<string>): Promise<BundleSignals> {
  const signals: BundleSignals = { openThreads: 0, published: false }
  const annotationsKey = `${BUNDLE_PREFIX}${project}/${slug}/${ANNOTATIONS_FILE}`
  const publishKey = `${BUNDLE_PREFIX}${project}/${slug}/${PUBLISH_FILE}`
  if (keys.has(annotationsKey)) {
    const annotations = await readJson(bucket, annotationsKey)
    const threads = annotations && typeof annotations === "object" && Array.isArray((annotations as { threads?: unknown }).threads)
      ? (annotations as { threads: unknown[] }).threads
      : []
    const open = threads.filter((thread): thread is { updatedAt?: unknown; messages?: unknown } =>
      !!thread && typeof thread === "object" && (thread as { status?: unknown }).status === "open")
    const newest = [...open].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))[0]
    const firstMessage = newest && Array.isArray(newest.messages) ? newest.messages[0] : undefined
    const body = firstMessage && typeof firstMessage === "object" ? (firstMessage as { body?: unknown }).body : undefined
    const line = typeof body === "string" ? body.replace(/\s+/g, " ").trim() : ""
    signals.openThreads = open.length
    if (line) signals.openExcerpt = line.length > EXCERPT_MAX ? `${line.slice(0, EXCERPT_MAX - 1)}…` : line
  }
  if (keys.has(publishKey)) {
    const publish = await readJson(bucket, publishKey)
    signals.published = !!publish && typeof publish === "object" && (publish as { status?: unknown }).status === "published"
  }
  return signals
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
