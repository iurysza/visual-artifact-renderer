import { createHash } from "node:crypto"
import { cp, mkdir, readdir, readFile, readlink, realpath, rename, rm, rmdir, stat } from "node:fs/promises"
import { join, relative, resolve } from "node:path"

import { fileExists, isKebabCase } from "../util.ts"
import { BUNDLE_FILES } from "./paths.ts"

interface BundleLocation {
  project: string
  slug: string
  path: string
}

export interface ArtifactStoreMigrationResult {
  target: string
  sources: string[]
  migrated: number
  deduplicated: number
  kept: number
}

export class ArtifactStoreConflictError extends Error {
  constructor(project: string, slug: string) {
    super(`Artifact store conflict for ${project}/${slug}; source and target bundles differ`)
    this.name = "ArtifactStoreConflictError"
  }
}

async function listBundles(root: string): Promise<BundleLocation[]> {
  const bundles: BundleLocation[] = []
  let projects
  try {
    projects = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return bundles
    throw error
  }

  for (const projectEntry of projects) {
    if (!projectEntry.isDirectory() || !isKebabCase(projectEntry.name)) continue
    const projectDir = join(root, projectEntry.name)
    const entries = await readdir(projectDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || !isKebabCase(entry.name)) continue
      const bundlePath = join(projectDir, entry.name)
      if (!(await fileExists(join(bundlePath, BUNDLE_FILES.artifact)))) continue
      bundles.push({ project: projectEntry.name, slug: entry.name, path: bundlePath })
    }
  }

  return bundles
}

async function directoryFingerprint(root: string): Promise<string> {
  const hash = createHash("sha256")

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const path = join(dir, entry.name)
      const rel = relative(root, path)
      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isSymbolicLink()) {
        hash.update(`link\0${rel}\0${await readlink(path)}\0`)
      } else if (entry.isFile()) {
        hash.update(`file\0${rel}\0`)
        hash.update(await readFile(path))
        hash.update("\0")
      }
    }
  }

  await walk(root)
  return hash.digest("hex")
}

async function removeEmptyProject(bundlePath: string): Promise<void> {
  try {
    await rmdir(resolve(bundlePath, ".."))
  } catch (error) {
    if (!["ENOTEMPTY", "ENOENT"].includes((error as { code?: string }).code ?? "")) throw error
  }
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return resolve(path)
    throw error
  }
}

export async function migrateArtifactStores(options: {
  sources: string[]
  target: string
  keepSource?: boolean
}): Promise<ArtifactStoreMigrationResult> {
  const target = resolve(options.target)
  await mkdir(target, { recursive: true })
  const canonicalTarget = await canonicalPath(target)
  const sourceCandidates = [...new Set(options.sources.map((source) => resolve(source)))]
  const sources: string[] = []
  const seenCanonicalSources = new Set<string>()
  for (const source of sourceCandidates) {
    const canonicalSource = await canonicalPath(source)
    if (canonicalSource === canonicalTarget || seenCanonicalSources.has(canonicalSource)) continue
    seenCanonicalSources.add(canonicalSource)
    sources.push(source)
  }
  const sourceBundles = (await Promise.all(sources.map(async (source) => ({ source, bundles: await listBundles(source) })))).flatMap(
    ({ source, bundles }) => bundles.map((bundle) => ({ source, ...bundle })),
  )

  const identities = new Map<string, { fingerprint: string; source: string }>()
  for (const bundle of sourceBundles) {
    const key = `${bundle.project}/${bundle.slug}`
    const fingerprint = await directoryFingerprint(bundle.path)
    const previous = identities.get(key)
    if (previous && previous.fingerprint !== fingerprint) {
      throw new ArtifactStoreConflictError(bundle.project, bundle.slug)
    }
    identities.set(key, { fingerprint, source: bundle.path })

    const destination = join(target, bundle.project, bundle.slug)
    try {
      const destinationStats = await stat(destination)
      if (!destinationStats.isDirectory() || (await directoryFingerprint(destination)) !== fingerprint) {
        throw new ArtifactStoreConflictError(bundle.project, bundle.slug)
      }
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") throw error
    }
  }

  const keepSource = options.keepSource !== false
  let migrated = 0
  let deduplicated = 0
  let kept = 0

  for (const bundle of sourceBundles) {
    const destination = join(target, bundle.project, bundle.slug)
    if (await fileExists(join(destination, BUNDLE_FILES.artifact))) {
      deduplicated += 1
    } else {
      await mkdir(resolve(destination, ".."), { recursive: true })
      const temporary = `${destination}.migrating-${process.pid}`
      await rm(temporary, { recursive: true, force: true })
      try {
        await cp(bundle.path, temporary, { recursive: true, force: false, errorOnExist: true })
        if ((await directoryFingerprint(temporary)) !== (await directoryFingerprint(bundle.path))) {
          throw new Error(`Artifact migration verification failed for ${bundle.project}/${bundle.slug}`)
        }
        await rename(temporary, destination)
      } catch (error) {
        await rm(temporary, { recursive: true, force: true })
        throw error
      }
      migrated += 1
    }

    if (keepSource) {
      kept += 1
    } else {
      await rm(bundle.path, { recursive: true, force: true })
      await removeEmptyProject(bundle.path)
    }
  }

  return { target, sources, migrated, deduplicated, kept }
}
