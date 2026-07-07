import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  cloudflareProfilePath,
  normalizeBaseUrl,
  readCloudflareProfile,
  resolveCloudflareProfile,
  writeCloudflareProfile,
  type CloudflarePublishProfile,
} from "./profile.ts"

async function withTempConfig<T>(fn: (env: NodeJS.ProcessEnv, dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "va-publish-profile-"))
  try {
    return await fn({ XDG_CONFIG_HOME: dir }, dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function profile(overrides: Partial<CloudflarePublishProfile> = {}): CloudflarePublishProfile {
  return {
    version: 1,
    provider: "cloudflare",
    accountId: "saved-account",
    bucketName: "saved-bucket",
    workerName: "saved-worker",
    baseUrl: "https://saved.example.com/artifacts",
    cloudBuildRouteStrategy: "placeholder",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("Cloudflare publish profiles", () => {
  test("stores non-secret profile under XDG config", async () => {
    await withTempConfig(async (env) => {
      const path = await writeCloudflareProfile(profile(), "default", env)
      expect(path).toBe(cloudflareProfilePath("default", env))

      const mode = (await stat(path)).mode & 0o777
      expect(mode).toBe(0o600)

      const raw = await readFile(path, "utf8")
      expect(raw).toContain("saved-account")
      expect(raw).not.toContain("secret")

      const saved = await readCloudflareProfile("default", env)
      expect(saved?.bucketName).toBe("saved-bucket")
    })
  })

  test("resolves flags, env vars, saved profile, then defaults", async () => {
    await withTempConfig(async (env) => {
      await writeCloudflareProfile(profile(), "default", env)
      const resolved = await resolveCloudflareProfile(
        {
          accountId: "flag-account",
          workersDevSubdomain: "flag-subdomain",
        },
        {
          profileName: "default",
          env: {
            ...env,
            VISUAL_ARTIFACT_CLOUDFLARE_R2_BUCKET: "env-bucket",
            VISUAL_ARTIFACT_CLOUDFLARE_WORKER_NAME: "env-worker",
            VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID: "top-secret-key",
            VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY: "top-secret-value",
          },
          now: new Date("2026-02-01T00:00:00.000Z"),
        },
      )

      expect(resolved.profile.accountId).toBe("flag-account")
      expect(resolved.profile.bucketName).toBe("env-bucket")
      expect(resolved.profile.workerName).toBe("env-worker")
      expect(resolved.profile.baseUrl).toBe("https://env-worker.flag-subdomain.workers.dev/artifacts")
      expect(resolved.profile.cloudBuildRouteStrategy).toBe("placeholder")
      expect(resolved.profile.createdAt).toBe("2026-01-01T00:00:00.000Z")
      expect(resolved.profile.updatedAt).toBe("2026-02-01T00:00:00.000Z")
      expect(resolved.secrets.r2AccessKeyId).toBe(true)
      expect(resolved.secrets.r2SecretAccessKey).toBe(true)
      expect(JSON.stringify(resolved)).not.toContain("top-secret")
    })
  })

  test("normalizes custom base URLs to the artifacts mount", () => {
    expect(normalizeBaseUrl("https://viz.example.com")).toBe("https://viz.example.com/artifacts")
    expect(normalizeBaseUrl("https://viz.example.com/artifacts/")).toBe("https://viz.example.com/artifacts")
    expect(normalizeBaseUrl("https://viz.example.com/viewer")).toBe("https://viz.example.com/viewer/artifacts")
  })

  test("reports missing required profile fields", async () => {
    await withTempConfig(async (env) => {
      const resolved = await resolveCloudflareProfile({}, { env })
      expect(resolved.missing).toEqual([
        "account id (--account-id or CLOUDFLARE_ACCOUNT_ID)",
        "R2 bucket (--bucket or VISUAL_ARTIFACT_CLOUDFLARE_R2_BUCKET)",
        "base URL (--base-url or --workers-dev-subdomain)",
      ])
      expect(resolved.profile.workerName).toBe("visual-artifact")
      expect(resolved.profile.cloudBuildRouteStrategy).toBe("zero-pages")
    })
  })
})
