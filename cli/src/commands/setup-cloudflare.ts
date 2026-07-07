import { createInterface } from "node:readline/promises"
import { stdin as input, stderr as output } from "node:process"

import type { Logger } from "../logger.ts"
import type { GlobalOpts } from "../types.ts"
import {
  DEFAULT_CLOUDFLARE_PROFILE_NAME,
  DEFAULT_CLOUDFLARE_WORKER_NAME,
  cloudflarePermissionHint,
  missingCloudflareSecretNames,
  resolveCloudflareProfile,
  writeCloudflareProfile,
  CLOUD_BUILD_ROUTE_STRATEGIES,
  DEFAULT_CLOUD_BUILD_ROUTE_STRATEGY,
  type CloudflareProfileInput,
  type CloudflareSecretPresence,
} from "../publish/profile.ts"

interface SetupCloudflareOpts extends GlobalOpts {
  accountId?: string
  bucket?: string
  workerName?: string
  baseUrl?: string
  workersDevSubdomain?: string
  cloudRouteStrategy?: string
  profile?: string
  nonInteractive?: boolean
  dryRun?: boolean
  input?: boolean
}

export async function setupCloudflare(opts: SetupCloudflareOpts, log: Logger): Promise<number> {
  const profileName = opts.profile?.trim() || DEFAULT_CLOUDFLARE_PROFILE_NAME
  const profileInput: CloudflareProfileInput = {
    accountId: opts.accountId,
    bucketName: opts.bucket,
    workerName: opts.workerName,
    baseUrl: opts.baseUrl,
    workersDevSubdomain: opts.workersDevSubdomain,
    cloudBuildRouteStrategy: opts.cloudRouteStrategy,
  }

  try {
    if (!promptsDisabled(opts)) {
      await promptForMissingProfileValues(profileInput, profileName)
    }

    const resolved = await resolveCloudflareProfile(profileInput, { profileName })
    if (resolved.missing.length > 0) {
      log.error(["Missing Cloudflare setup values:", ...resolved.missing.map((item) => `- ${item}`)].join("\n"))
      log.log("Run `visual-artifact setup cloudflare --help` for flag and env-var names.")
      return 2
    }

    const missingSecrets = missingCloudflareSecretNames(resolved.secrets)
    if (missingSecrets.length > 0) {
      log.error(["Missing Cloudflare secret environment variables:", ...missingSecrets.map((item) => `- ${item}`), "", cloudflarePermissionHint()].join("\n"))
      return 2
    }

    const profilePath = opts.dryRun
      ? resolved.profilePath
      : await writeCloudflareProfile(resolved.profile, profileName)

    if (opts.json) {
      log.output({
        ok: true,
        provider: "cloudflare",
        dryRun: opts.dryRun ?? false,
        profileName,
        profilePath,
        profile: resolved.profile,
        secretStatus: secretStatusFor(resolved.secrets),
        warnings: [],
      })
      return 0
    }

    log.success(opts.dryRun ? "Cloudflare setup looks valid" : "Cloudflare publish profile saved")
    log.log(`  profile: ${profilePath}`)
    log.log(`  bucket:  ${resolved.profile.bucketName}`)
    log.log(`  worker:  ${resolved.profile.workerName}`)
    log.log(`  url:     ${resolved.profile.baseUrl}`)
    log.log(`  routes:  ${resolved.profile.cloudBuildRouteStrategy}`)
    log.log("  secrets: env-only; no credentials were written to disk")
    return 0
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

async function promptForMissingProfileValues(inputValues: CloudflareProfileInput, profileName: string): Promise<void> {
  if (process.stdin.isTTY === false) return

  const current = await resolveCloudflareProfile(inputValues, { profileName })
  const rl = createInterface({ input, output })
  try {
    if (!current.profile.accountId) {
      inputValues.accountId = await promptValue(rl, "Cloudflare account ID")
    }
    if (!current.profile.bucketName) {
      inputValues.bucketName = await promptValue(rl, "R2 bucket name")
    }
    if (!inputValues.workerName && current.profile.workerName === DEFAULT_CLOUDFLARE_WORKER_NAME) {
      inputValues.workerName = await promptValue(rl, "Worker name", DEFAULT_CLOUDFLARE_WORKER_NAME)
    }
    const refreshed = await resolveCloudflareProfile(inputValues, { profileName })
    if (!refreshed.profile.baseUrl) {
      const baseUrl = await promptValue(rl, "Public base URL (leave empty for workers.dev)")
      if (baseUrl) {
        inputValues.baseUrl = baseUrl
      } else {
        inputValues.workersDevSubdomain = await promptValue(
          rl,
          "workers.dev subdomain",
          inputValues.workersDevSubdomain,
        )
      }
    }

    if (!inputValues.cloudBuildRouteStrategy && !process.env.VISUAL_ARTIFACT_CLOUD_ROUTE_STRATEGY) {
      inputValues.cloudBuildRouteStrategy = await promptRouteStrategy(rl, refreshed.profile.cloudBuildRouteStrategy)
    }
  } finally {
    rl.close()
  }
}

async function promptValue(
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue?: string,
): Promise<string | undefined> {
  const suffix = defaultValue ? ` [${defaultValue}]` : ""
  const answer = await rl.question(`${label}${suffix}: `)
  const trimmed = answer.trim()
  return trimmed || defaultValue
}

async function promptRouteStrategy(
  rl: ReturnType<typeof createInterface>,
  defaultValue: string = DEFAULT_CLOUD_BUILD_ROUTE_STRATEGY,
): Promise<string> {
  const choices = CLOUD_BUILD_ROUTE_STRATEGIES.join("/")
  const answer = await rl.question(
    `Cloud build route strategy (${choices}) [${defaultValue}] — zero-pages is recommended: `,
  )
  return answer.trim() || defaultValue
}

function promptsDisabled(opts: SetupCloudflareOpts): boolean {
  return opts.nonInteractive === true || opts.noInput === true || opts.input === false
}

function secretStatusFor(secrets: CloudflareSecretPresence): Record<keyof CloudflareSecretPresence, "present" | "missing"> {
  return {
    r2AccessKeyId: secrets.r2AccessKeyId ? "present" : "missing",
    r2SecretAccessKey: secrets.r2SecretAccessKey ? "present" : "missing",
  }
}
