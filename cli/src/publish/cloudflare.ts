import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"

import type { CloudflarePublishProfile } from "./profile.ts"

export interface CloudflarePublishSecrets {
  r2AccessKeyId: string
  r2SecretAccessKey: string
}

export interface CloudflarePublishContext {
  profile: CloudflarePublishProfile
  secrets: CloudflarePublishSecrets
}

export interface PublishResult {
  ok: true
  project: string
  slug: string
  url: string
  localUrl: string
  remoteObjects: string[]
}

export interface PublishMetadata {
  version: 1
  status: "published"
  provider: "cloudflare"
  profileName: string
  project: string
  slug: string
  url: string
  localUrl: string
  publishedAt: string
  remoteObjects: string[]
  cloudflare: {
    accountId: string
    bucketName: string
    workerName: string
    baseUrl: string
  }
}

const ASSET_FILE = "artifact.json"
const ANNOTATIONS_FILE = "annotations.json"
const ASSETS_DIR = "assets"

export async function loadPublishContext(
  profile: CloudflarePublishProfile,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CloudflarePublishContext> {
  const r2AccessKeyId = env.VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID?.trim() ?? env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim()
  const r2SecretAccessKey = env.VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim() ?? env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim()

  if (!r2AccessKeyId) throw new Error("Missing VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID")
  if (!r2SecretAccessKey) throw new Error("Missing VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY")

  return {
    profile,
    secrets: { r2AccessKeyId, r2SecretAccessKey },
  }
}

export function makeS3Client(context: CloudflarePublishContext): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${context.profile.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: context.secrets.r2AccessKeyId,
      secretAccessKey: context.secrets.r2SecretAccessKey,
    },
  })
}

export async function publishBundle(
  context: CloudflarePublishContext,
  project: string,
  slug: string,
  bundleDir: string,
): Promise<PublishResult> {
  const s3 = makeS3Client(context)
  const bucket = context.profile.bucketName
  const artifactPath = path.join(bundleDir, ASSET_FILE)
  if (!existsSync(artifactPath)) {
    throw new Error(`Artifact bundle missing ${ASSET_FILE}: ${bundleDir}`)
  }

  const remoteObjects: string[] = []

  // Upload artifact.json
  const artifactKey = r2Key(project, slug, ASSET_FILE)
  await uploadFile(s3, bucket, artifactKey, artifactPath, "application/json")
  remoteObjects.push(artifactKey)

  // Upload or synthesize annotations.json
  const annotationsPath = path.join(bundleDir, ANNOTATIONS_FILE)
  if (existsSync(annotationsPath)) {
    const annotationsKey = r2Key(project, slug, ANNOTATIONS_FILE)
    await uploadFile(s3, bucket, annotationsKey, annotationsPath, "application/json")
    remoteObjects.push(annotationsKey)
  } else {
    const annotationsKey = r2Key(project, slug, ANNOTATIONS_FILE)
    await uploadData(s3, bucket, annotationsKey, emptyAnnotationsDocument(project, slug), "application/json")
    remoteObjects.push(annotationsKey)
  }

  // Upload assets while preserving hierarchy
  const assetsDir = path.join(bundleDir, ASSETS_DIR)
  if (existsSync(assetsDir)) {
    const assetFiles = await listAssetFiles(assetsDir)
    for (const relativePath of assetFiles) {
      const localPath = path.join(assetsDir, relativePath)
      const key = r2AssetKey(project, slug, relativePath)
      const contentType = guessContentType(relativePath)
      await uploadFile(s3, bucket, key, localPath, contentType)
      remoteObjects.push(key)
    }
  }

  return {
    ok: true,
    project,
    slug,
    url: remoteArtifactPageUrl(context.profile, project, slug),
    localUrl: localArtifactPageUrl(project, slug),
    remoteObjects,
  }
}

export function r2Key(project: string, slug: string, file: string): string {
  const safeProject = encodeSegment(project)
  const safeSlug = encodeSegment(slug)
  const safeFile = encodeSegment(file)
  return `artifacts/${safeProject}/${safeSlug}/${safeFile}`
}

export function r2AssetKey(project: string, slug: string, relativePath: string): string {
  const safeProject = encodeSegment(project)
  const safeSlug = encodeSegment(slug)
  const safeRelativePath = relativePath
    .split("/")
    .map((segment) => encodeSegment(segment))
    .join("/")
  return `artifacts/${safeProject}/${safeSlug}/${ASSETS_DIR}/${safeRelativePath}`
}

export function remoteArtifactPageUrl(profile: CloudflarePublishProfile, project: string, slug: string): string {
  const base = profile.baseUrl.replace(/\/+$/, "")
  const safeProject = encodeSegment(project)
  const safeSlug = encodeSegment(slug)
  return `${base}/${safeProject}/${safeSlug}/`
}

export function localArtifactPageUrl(project: string, slug: string): string {
  return `http://127.0.0.1:9998/artifacts/${encodeSegment(project)}/${encodeSegment(slug)}/`
}

export function buildPublishMetadata(
  context: CloudflarePublishContext,
  result: PublishResult,
  profileName: string,
  now = new Date(),
): PublishMetadata {
  return {
    version: 1,
    status: "published",
    provider: "cloudflare",
    profileName,
    project: result.project,
    slug: result.slug,
    url: result.url,
    localUrl: result.localUrl,
    publishedAt: now.toISOString(),
    remoteObjects: result.remoteObjects,
    cloudflare: {
      accountId: context.profile.accountId,
      bucketName: context.profile.bucketName,
      workerName: context.profile.workerName,
      baseUrl: context.profile.baseUrl,
    },
  }
}

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function encodeSegment(value: string): string {
  if (KEBAB_RE.test(value)) return value
  return encodeURIComponent(value)
}

async function uploadFile(
  s3: S3Client,
  bucket: string,
  key: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const body = await readFile(filePath)
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

async function uploadData(
  s3: S3Client,
  bucket: string,
  key: string,
  body: string,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

async function listAssetFiles(root: string): Promise<string[]> {
  const files: string[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        files.push(path.relative(root, fullPath).split(path.sep).join("/"))
      }
    }
  }

  await walk(root)
  return files.sort()
}

function emptyAnnotationsDocument(project: string, slug: string): string {
  return JSON.stringify(
    {
      version: 1,
      project,
      slug,
      threads: [],
    },
    null,
    2,
  )
}

function guessContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  switch (ext) {
    case ".json":
      return "application/json"
    case ".svg":
      return "image/svg+xml"
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".gif":
      return "image/gif"
    case ".webp":
      return "image/webp"
    case ".css":
      return "text/css"
    case ".js":
      return "application/javascript"
    case ".html":
      return "text/html"
    default:
      return "application/octet-stream"
  }
}

export { HeadObjectCommand }
