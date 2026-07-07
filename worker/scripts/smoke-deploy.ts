/**
 * Post-deploy smoke test for the Cloudflare Worker.
 *
 * Usage:
 *   bun run scripts/smoke-deploy.ts <base-url>
 *
 * The base URL is the root of the deployed Worker, e.g.
 * https://visual-artifact.iurysza.workers.dev
 */

interface Check {
  name: string
  url: string
  expectStatus: number
  expectHtml?: boolean
  expectJson?: boolean
  validate?: (body: unknown) => boolean
}

async function main(): Promise<void> {
  const baseUrl = (process.argv[2] ?? process.env.VISUAL_ARTIFACT_CLOUDFLARE_BASE_URL ?? "").replace(/\/+$/, "")
  if (!baseUrl) {
    console.error("Usage: bun run scripts/smoke-deploy.ts <base-url>")
    console.error("Or set VISUAL_ARTIFACT_CLOUDFLARE_BASE_URL.")
    process.exit(1)
  }

  const artifactProject = process.env.VISUAL_ARTIFACT_SMOKE_PROJECT ?? "visualizer"
  const artifactSlug = process.env.VISUAL_ARTIFACT_SMOKE_SLUG ?? "cloudflare-smoke"

  const checks: Check[] = [
    {
      name: "home shell",
      url: `${baseUrl}/`,
      expectStatus: 200,
      expectHtml: true,
    },
    {
      name: "home index JSON",
      url: `${baseUrl}/data/artifacts/index.json`,
      expectStatus: 200,
      expectJson: true,
      validate: (body) =>
        typeof body === "object" &&
        body !== null &&
        Array.isArray((body as Record<string, unknown>).projects) &&
        Array.isArray((body as Record<string, unknown>).recent),
    },
    {
      name: "published artifact page shell",
      url: `${baseUrl}/${artifactProject}/${artifactSlug}/`,
      expectStatus: 200,
      expectHtml: true,
    },
    {
      name: "published artifact JSON",
      url: `${baseUrl}/data/artifacts/${artifactProject}/${artifactSlug}/artifact.json`,
      expectStatus: 200,
      expectJson: true,
      validate: (body) =>
        typeof body === "object" &&
        body !== null &&
        typeof (body as Record<string, unknown>).title === "string" &&
        typeof (body as Record<string, unknown>).slug === "string",
    },
  ]

  let failures = 0

  for (const check of checks) {
    const result = await runCheck(check)
    if (result.ok) {
      console.log(`✓ ${check.name}: ${check.url}`)
    } else {
      failures++
      console.error(`✗ ${check.name}: ${check.url}`)
      console.error(`  ${result.reason}`)
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`)
    process.exit(1)
  }

  console.log("\nAll deploy smoke checks passed")
}

async function runCheck(check: Check): Promise<{ ok: true } | { ok: false; reason: string }> {
  const response = await fetch(check.url, { method: "GET" })
  if (response.status !== check.expectStatus) {
    return { ok: false, reason: `expected status ${check.expectStatus}, got ${response.status}` }
  }

  const contentType = response.headers.get("content-type") ?? ""

  if (check.expectHtml && !contentType.includes("text/html")) {
    return { ok: false, reason: `expected text/html, got ${contentType}` }
  }

  if (check.expectJson && !contentType.includes("application/json")) {
    return { ok: false, reason: `expected application/json, got ${contentType}` }
  }

  if (check.validate) {
    let body: unknown
    try {
      body = check.expectJson ? await response.json() : await response.text()
    } catch (error) {
      return { ok: false, reason: `could not read body: ${error instanceof Error ? error.message : String(error)}` }
    }
    if (!check.validate(body)) {
      return { ok: false, reason: `validation failed: ${JSON.stringify(body).slice(0, 200)}` }
    }
  }

  return { ok: true }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
