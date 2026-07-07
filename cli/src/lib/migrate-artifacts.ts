import { copyFile, mkdir, readdir, readFile, rename, stat, utimes, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { emptyAnnotationDocument } from "@agents/visual-artifact-annotations"
import {
  BUNDLE_FILES,
  annotationsJsonPath,
  artifactJsonPath,
  assetsDirPath,
  bundleDirPath,
  isInsideArtifactsDir,
} from "./paths.ts"
import { fileExists, isKebabCase } from "../util.ts"

export interface MigrateFlatArtifactsOptions {
  artifactsDir: string
  apply?: boolean
  backupDir?: string
}

export type MigrationStatus = "migrated" | "would-migrate" | "skipped"

export interface MigrationResult {
  project: string
  slug: string
  sourcePath: string
  bundleDir: string
  artifactPath: string
  backupPath?: string
  status: MigrationStatus
  reason?: string
}

export interface MigrationSummary {
  artifactsDir: string
  backupDir: string
  apply: boolean
  migrated: number
  wouldMigrate: number
  skipped: number
  results: MigrationResult[]
}

function defaultBackupDir(artifactsDir: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  return join(dirname(artifactsDir), ".migration-backup", stamp)
}

function isJsonFile(name: string): boolean {
  return name.endsWith(".json")
}

function slugFromFileName(name: string): string {
  return name.slice(0, -".json".length)
}

function skippedResult(params: Omit<MigrationResult, "status">): MigrationResult {
  return { ...params, status: "skipped" }
}

async function parseArtifactJson(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8")
  return JSON.parse(raw)
}

export async function migrateFlatArtifacts(options: MigrateFlatArtifactsOptions): Promise<MigrationSummary> {
  const artifactsDir = resolve(options.artifactsDir)
  const apply = options.apply === true
  const backupDir = resolve(options.backupDir ?? defaultBackupDir(artifactsDir))
  const results: MigrationResult[] = []

  const projectEntries = await readdir(artifactsDir, { withFileTypes: true }).catch((error: any) => {
    if (error.code === "ENOENT") return []
    throw error
  })

  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory()) continue
    const project = projectEntry.name
    if (!isKebabCase(project)) continue

    const projectDir = join(artifactsDir, project)
    const artifactEntries = await readdir(projectDir, { withFileTypes: true })

    for (const artifactEntry of artifactEntries) {
      if (!artifactEntry.isFile()) continue
      if (!isJsonFile(artifactEntry.name)) continue
      if (artifactEntry.name === BUNDLE_FILES.artifact || artifactEntry.name === BUNDLE_FILES.annotations) continue

      const slug = slugFromFileName(artifactEntry.name)
      const sourcePath = join(projectDir, artifactEntry.name)
      const bundleDir = bundleDirPath(artifactsDir, project, slug)
      const artifactPath = artifactJsonPath(artifactsDir, project, slug)
      const backupPath = join(backupDir, project, artifactEntry.name)

      if (!isKebabCase(slug)) {
        results.push(skippedResult({ project, slug, sourcePath, bundleDir, artifactPath, reason: "slug is not kebab-case" }))
        continue
      }

      if (!isInsideArtifactsDir(artifactPath, artifactsDir) || !isInsideArtifactsDir(backupPath, backupDir)) {
        results.push(skippedResult({ project, slug, sourcePath, bundleDir, artifactPath, reason: "path escaped migration root" }))
        continue
      }

      let parsed: unknown
      try {
        parsed = await parseArtifactJson(sourcePath)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push(skippedResult({ project, slug, sourcePath, bundleDir, artifactPath, reason: `invalid JSON: ${message}` }))
        continue
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        results.push(skippedResult({ project, slug, sourcePath, bundleDir, artifactPath, reason: "JSON root is not an object" }))
        continue
      }

      const parsedSlug = "slug" in parsed ? parsed.slug : undefined
      if (typeof parsedSlug === "string" && parsedSlug !== slug) {
        results.push(skippedResult({ project, slug, sourcePath, bundleDir, artifactPath, reason: `artifact slug is ${parsedSlug}` }))
        continue
      }

      if (await fileExists(artifactPath)) {
        results.push(skippedResult({ project, slug, sourcePath, bundleDir, artifactPath, reason: "bundle artifact.json already exists" }))
        continue
      }

      if (!apply) {
        results.push({ project, slug, sourcePath, bundleDir, artifactPath, backupPath, status: "would-migrate" })
        continue
      }

      const sourceStats = await stat(sourcePath)
      await mkdir(bundleDir, { recursive: true })
      await mkdir(assetsDirPath(artifactsDir, project, slug), { recursive: true })
      await mkdir(dirname(backupPath), { recursive: true })
      await copyFile(sourcePath, backupPath)
      await utimes(backupPath, sourceStats.atime, sourceStats.mtime)
      await rename(sourcePath, artifactPath)
      await utimes(artifactPath, sourceStats.atime, sourceStats.mtime)

      const annotationsPath = annotationsJsonPath(artifactsDir, project, slug)
      if (!(await fileExists(annotationsPath))) {
        const annotations = emptyAnnotationDocument(project, slug)
        await writeFile(annotationsPath, `${JSON.stringify(annotations, null, 2)}\n`, "utf8")
      }

      results.push({ project, slug, sourcePath, bundleDir, artifactPath, backupPath, status: "migrated" })
    }
  }

  return {
    artifactsDir,
    backupDir,
    apply,
    migrated: results.filter((result) => result.status === "migrated").length,
    wouldMigrate: results.filter((result) => result.status === "would-migrate").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results,
  }
}
