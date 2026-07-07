import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { resolve } from "node:path"

export const CLOUDFLARE_PROVIDER = "cloudflare" as const
export const DEFAULT_CLOUDFLARE_PROFILE_NAME = "default"
export const DEFAULT_CLOUDFLARE_WORKER_NAME = "visual-artifact"
export const DEFAULT_CLOUD_BUILD_ROUTE_STRATEGY = "zero-pages" as const
export const CLOUD_BUILD_ROUTE_STRATEGIES = ["zero-pages", "placeholder"] as const
export type CloudBuildRouteStrategy = (typeof CLOUD_BUILD_ROUTE_STRATEGIES)[number]

export interface CloudflarePublishProfile {
  version: 1
  provider: typeof CLOUDFLARE_PROVIDER
  accountId: string
  bucketName: string
  workerName: string
  baseUrl: string
  cloudBuildRouteStrategy: CloudBuildRouteStrategy
  createdAt: string
  updatedAt: string
}

export interface CloudflareProfileInput {
  accountId?: string
  bucketName?: string
  workerName?: string
  baseUrl?: string
  workersDevSubdomain?: string
  cloudBuildRouteStrategy?: string
}

export interface CloudflareSecretPresence {
  r2AccessKeyId: boolean
  r2SecretAccessKey: boolean
}

export interface ResolvedCloudflareProfile {
  profile: CloudflarePublishProfile
  profilePath: string
  missing: string[]
  secrets: CloudflareSecretPresence
}

export function publishConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const baseDir = env.XDG_CONFIG_HOME?.trim() || resolve(homedir(), ".config")
  return resolve(baseDir, "visual-artifact", "publish-profiles")
}

export function cloudflareProfilePath(
  profileName = DEFAULT_CLOUDFLARE_PROFILE_NAME,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const suffix = profileName === DEFAULT_CLOUDFLARE_PROFILE_NAME ? "cloudflare" : `cloudflare.${profileName}`
  return resolve(publishConfigDir(env), `${suffix}.json`)
}

export async function readCloudflareProfile(
  profileName = DEFAULT_CLOUDFLARE_PROFILE_NAME,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CloudflarePublishProfile | null> {
  const path = cloudflareProfilePath(profileName, env)
  if (!existsSync(path)) return null
  const raw = await readFile(path, "utf8")
  const parsed = JSON.parse(raw) as unknown
  return parseCloudflareProfile(parsed, path)
}

export async function writeCloudflareProfile(
  profile: CloudflarePublishProfile,
  profileName = DEFAULT_CLOUDFLARE_PROFILE_NAME,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const path = cloudflareProfilePath(profileName, env)
  await mkdir(publishConfigDir(env), { recursive: true })
  await writeFile(path, `${JSON.stringify(profile, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
  return path
}

export async function resolveCloudflareProfile(
  input: CloudflareProfileInput,
  options: { profileName?: string; env?: NodeJS.ProcessEnv; now?: Date } = {},
): Promise<ResolvedCloudflareProfile> {
  const env = options.env ?? process.env
  const profileName = options.profileName ?? DEFAULT_CLOUDFLARE_PROFILE_NAME
  const saved = await readCloudflareProfile(profileName, env)
  const now = (options.now ?? new Date()).toISOString()
  const workerName = firstValue(
    input.workerName,
    env.VISUAL_ARTIFACT_CLOUDFLARE_WORKER_NAME,
    saved?.workerName,
    DEFAULT_CLOUDFLARE_WORKER_NAME,
  ) ?? DEFAULT_CLOUDFLARE_WORKER_NAME
  const workersDevUrl = workersDevBaseUrl(
    workerName,
    firstValue(input.workersDevSubdomain, env.VISUAL_ARTIFACT_CLOUDFLARE_WORKERS_DEV_SUBDOMAIN),
  )
  const baseUrl = normalizeBaseUrl(
    firstValue(input.baseUrl, env.VISUAL_ARTIFACT_CLOUDFLARE_BASE_URL, workersDevUrl, saved?.baseUrl),
  )
  const cloudBuildRouteStrategy = parseCloudBuildRouteStrategy(
    firstValue(
      input.cloudBuildRouteStrategy,
      env.VISUAL_ARTIFACT_CLOUD_ROUTE_STRATEGY,
      saved?.cloudBuildRouteStrategy,
      DEFAULT_CLOUD_BUILD_ROUTE_STRATEGY,
    ),
  )

  const profile: CloudflarePublishProfile = {
    version: 1,
    provider: CLOUDFLARE_PROVIDER,
    accountId: firstValue(input.accountId, env.CLOUDFLARE_ACCOUNT_ID, env.VISUAL_ARTIFACT_CLOUDFLARE_ACCOUNT_ID, saved?.accountId) ?? "",
    bucketName: firstValue(input.bucketName, env.VISUAL_ARTIFACT_CLOUDFLARE_R2_BUCKET, env.CLOUDFLARE_R2_BUCKET, saved?.bucketName) ?? "",
    workerName,
    baseUrl: baseUrl ?? "",
    cloudBuildRouteStrategy,
    createdAt: saved?.createdAt ?? now,
    updatedAt: now,
  }

  const missing = requiredProfileFields(profile)
  return {
    profile,
    profilePath: cloudflareProfilePath(profileName, env),
    missing,
    secrets: readCloudflareSecretPresence(env),
  }
}

export function readCloudflareSecretPresence(env: NodeJS.ProcessEnv = process.env): CloudflareSecretPresence {
  return {
    r2AccessKeyId: Boolean(firstValue(env.VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID, env.CLOUDFLARE_R2_ACCESS_KEY_ID)),
    r2SecretAccessKey: Boolean(firstValue(env.VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY, env.CLOUDFLARE_R2_SECRET_ACCESS_KEY)),
  }
}

export function missingCloudflareSecretNames(secrets: CloudflareSecretPresence): string[] {
  const missing: string[] = []
  if (!secrets.r2AccessKeyId) missing.push("VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID")
  if (!secrets.r2SecretAccessKey) missing.push("VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY")
  return missing
}

export function cloudflarePermissionHint(): string {
  return [
    "Create Cloudflare R2 access keys for the target bucket.",
    "Then export VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID and VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY before running setup again.",
  ].join("\n")
}

export function requiredProfileFields(profile: CloudflarePublishProfile): string[] {
  const missing: string[] = []
  if (!profile.accountId.trim()) missing.push("account id (--account-id or CLOUDFLARE_ACCOUNT_ID)")
  if (!profile.bucketName.trim()) missing.push("R2 bucket (--bucket or VISUAL_ARTIFACT_CLOUDFLARE_R2_BUCKET)")
  if (!profile.workerName.trim()) missing.push("Worker name (--worker-name)")
  if (!profile.baseUrl.trim()) missing.push("base URL (--base-url or --workers-dev-subdomain)")
  return missing
}

export function parseCloudBuildRouteStrategy(value: string | undefined): CloudBuildRouteStrategy {
  const strategy = value?.trim() || DEFAULT_CLOUD_BUILD_ROUTE_STRATEGY
  if (CLOUD_BUILD_ROUTE_STRATEGIES.includes(strategy as CloudBuildRouteStrategy)) {
    return strategy as CloudBuildRouteStrategy
  }
  throw new Error(
    `Invalid cloud build route strategy: ${value}. Expected one of: ${CLOUD_BUILD_ROUTE_STRATEGIES.join(", ")}`,
  )
}

export function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const url = new URL(trimmed)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Cloudflare base URL must start with http:// or https://: ${value}`)
  }

  url.pathname = appendArtifactsMount(url.pathname)
  return url.toString().replace(/\/+$/, "")
}

function appendArtifactsMount(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "")
  if (trimmed === "/artifacts" || trimmed.endsWith("/artifacts")) return trimmed
  if (!trimmed || trimmed === "/") return "/artifacts"
  return `${trimmed}/artifacts`
}

export function workersDevBaseUrl(workerName: string, workersDevSubdomain: string | undefined): string | undefined {
  const subdomain = workersDevSubdomain?.trim()
  if (!subdomain) return undefined
  return `https://${workerName}.${subdomain}.workers.dev/artifacts`
}

function parseCloudflareProfile(value: unknown, path: string): CloudflarePublishProfile {
  if (!value || typeof value !== "object") throw new Error(`Invalid Cloudflare profile JSON: ${path}`)
  const obj = value as Record<string, unknown>
  const profile: CloudflarePublishProfile = {
    version: obj.version as 1,
    provider: obj.provider as typeof CLOUDFLARE_PROVIDER,
    accountId: stringField(obj.accountId),
    bucketName: stringField(obj.bucketName),
    workerName: stringField(obj.workerName),
    baseUrl: stringField(obj.baseUrl),
    cloudBuildRouteStrategy: parseCloudBuildRouteStrategy(stringField(obj.cloudBuildRouteStrategy)),
    createdAt: stringField(obj.createdAt),
    updatedAt: stringField(obj.updatedAt),
  }
  if (profile.version !== 1 || profile.provider !== CLOUDFLARE_PROVIDER) {
    throw new Error(`Unsupported Cloudflare profile format: ${path}`)
  }
  const missing = requiredProfileFields(profile)
  if (missing.length > 0) throw new Error(`Incomplete Cloudflare profile ${path}: missing ${missing.join(", ")}`)
  return profile
}

function firstValue(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : ""
}
