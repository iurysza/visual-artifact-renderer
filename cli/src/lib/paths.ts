import { resolve } from "node:path"
import { isKebabCase } from "../util.ts"

export const BUNDLE_FILES = {
  artifact: "artifact.json",
  annotations: "annotations.json",
  assets: "assets",
  publish: "publish.json",
} as const

export interface BundleRoute {
  project: string
  slug: string
}

export interface ProjectRoute {
  project: string
}

/**
 * Validate artifact route segments.
 *
 * Returns a typed route only when both segments are safe kebab-case names.
 * This rejects path traversal (..), slashes, and other characters that would
 * escape the artifacts directory.
 */
export function parseBundleRoute(project: unknown, slug: unknown): BundleRoute | null {
  if (typeof project !== "string" || typeof slug !== "string") return null
  if (!isKebabCase(project) || !isKebabCase(slug)) return null
  return { project, slug }
}

/**
 * Validate a project route segment.
 */
export function parseProjectRoute(project: unknown): ProjectRoute | null {
  if (typeof project !== "string") return null
  if (!isKebabCase(project)) return null
  return { project }
}

/** Absolute path to the bundle directory for an artifact. */
export function bundleDirPath(artifactsDir: string, project: string, slug: string): string {
  return resolve(artifactsDir, project, slug)
}

/** Absolute path to the artifact.json inside a bundle. */
export function artifactJsonPath(artifactsDir: string, project: string, slug: string): string {
  return resolve(artifactsDir, project, slug, BUNDLE_FILES.artifact)
}

/** Absolute path to the annotations.json inside a bundle. */
export function annotationsJsonPath(artifactsDir: string, project: string, slug: string): string {
  return resolve(artifactsDir, project, slug, BUNDLE_FILES.annotations)
}

/** Absolute path to the assets directory inside a bundle. */
export function assetsDirPath(artifactsDir: string, project: string, slug: string): string {
  return resolve(artifactsDir, project, slug, BUNDLE_FILES.assets)
}

/** Absolute path to publish metadata inside a bundle. */
export function publishJsonPath(artifactsDir: string, project: string, slug: string): string {
  return resolve(artifactsDir, project, slug, BUNDLE_FILES.publish)
}

/**
 * Return true when the resolved path is inside the resolved artifacts directory.
 *
 * Both paths are normalized with `resolve` before comparison, so relative
 * segments like `..` are collapsed before the check.
 */
export function isInsideArtifactsDir(path: string, artifactsDir: string): boolean {
  const resolved = resolve(path)
  const resolvedArtifactsDir = resolve(artifactsDir)
  return resolved === resolvedArtifactsDir || resolved.startsWith(`${resolvedArtifactsDir}/`)
}
