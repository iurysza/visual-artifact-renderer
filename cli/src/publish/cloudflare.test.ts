import { describe, expect, test } from "bun:test"
import { r2Key, r2AssetKey, remoteArtifactPageUrl, encodeSegment, localArtifactPageUrl, loadPublishContext, buildPublishMetadata } from "./cloudflare.ts"
import type { CloudflarePublishProfile } from "./profile.ts"

function profile(overrides: Partial<CloudflarePublishProfile> = {}): CloudflarePublishProfile {
  return {
    version: 1,
    provider: "cloudflare",
    accountId: "acct",
    bucketName: "bucket",
    workerName: "visual-artifact",
    baseUrl: "https://visual-artifact.demo.workers.dev",
    cloudBuildRouteStrategy: "zero-pages",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("Cloudflare R2 publisher keys", () => {
  test("r2Key uses kebab-case segments unchanged", () => {
    expect(r2Key("my-project", "my-slug", "artifact.json")).toBe("artifacts/my-project/my-slug/artifact.json")
  })

  test("r2AssetKey preserves slash hierarchy", () => {
    expect(r2AssetKey("my-project", "my-slug", "diagrams/flow.svg")).toBe(
      "artifacts/my-project/my-slug/assets/diagrams/flow.svg",
    )
  })

  test("encodeSegment percent-encodes unsafe characters", () => {
    expect(encodeSegment("my project")).toBe("my%20project")
    expect(encodeSegment("a/b")).toBe("a%2Fb")
  })

  test("kebab-case segments are not encoded", () => {
    expect(encodeSegment("foo-bar-123")).toBe("foo-bar-123")
  })

  test("remoteArtifactPageUrl appends project and slug with trailing slash", () => {
    expect(remoteArtifactPageUrl(profile(), "my-project", "my-slug")).toBe(
      "https://visual-artifact.demo.workers.dev/my-project/my-slug/",
    )
  })

  test("remoteArtifactPageUrl strips extra trailing slashes from base", () => {
    const p = profile({ baseUrl: "https://example.com/" })
    expect(remoteArtifactPageUrl(p, "p", "s")).toBe("https://example.com/p/s/")
  })

  test("localArtifactPageUrl points at default static server", () => {
    expect(localArtifactPageUrl("p", "s")).toBe("http://127.0.0.1:9998/artifacts/p/s/")
  })

  test("loadPublishContext only requires R2 S3 credentials", async () => {
    const context = await loadPublishContext(profile(), {
      VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID: "key",
      VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY: "secret",
    } as NodeJS.ProcessEnv)

    expect(context.secrets.r2AccessKeyId).toBe("key")
    expect(context.secrets.r2SecretAccessKey).toBe("secret")
  })

  test("buildPublishMetadata records publish state without secrets", async () => {
    const context = await loadPublishContext(profile(), {
      VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID: "key",
      VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY: "top-secret",
    } as NodeJS.ProcessEnv)
    const metadata = buildPublishMetadata(
      context,
      {
        ok: true,
        project: "demo",
        slug: "hello",
        url: "https://visual-artifact.demo.workers.dev/demo/hello/",
        localUrl: "http://127.0.0.1:9998/artifacts/demo/hello/",
        remoteObjects: ["artifacts/demo/hello/artifact.json"],
      },
      "default",
      new Date("2026-01-02T00:00:00.000Z"),
    )

    expect(metadata.status).toBe("published")
    expect(metadata.publishedAt).toBe("2026-01-02T00:00:00.000Z")
    expect(metadata.cloudflare.bucketName).toBe("bucket")
    expect(JSON.stringify(metadata)).not.toContain("top-secret")
  })
})
