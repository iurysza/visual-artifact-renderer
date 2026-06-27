#!/usr/bin/env node

/**
 * Simple health check for the running Next.js dev/prod server.
 *
 * Usage:
 *   pnpm dev          # start the server first
 *   pnpm health-check
 *
 * Or point it elsewhere:
 *   BASE_URL=http://localhost:3000/my-app pnpm health-check
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:9999/artifacts"
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || "5000")

const checks = [
  {
    name: "home page",
    path: "/",
    mustContain: ["Your visual workspace", "View Components"],
  },
  {
    name: "components page",
    path: "/components",
    mustContain: [
      "Component Library",
      "Markdown",
      "Use Prose for rich text",
      "react-markdown",
      "remark-gfm",
      "Hello, ${name}!",
    ],
  },
]

async function fetchText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    const text = await response.text()
    return { status: response.status, text }
  } finally {
    clearTimeout(timer)
  }
}

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

function ok(message) {
  console.log(`✅ ${message}`)
}

async function main() {
  console.log(`🔍 Health checking ${BASE_URL}\n`)

  for (const check of checks) {
    const base = BASE_URL.replace(/\/$/, "")
    const url = `${base}${check.path}`
    let result

    try {
      result = await fetchText(url)
    } catch (error) {
      const reason = error.name === "AbortError" ? "timed out" : error.message
      fail(`/${check.name} (${url}) unreachable — ${reason}`)
    }

    if (result.status !== 200) {
      fail(`${check.name} returned HTTP ${result.status}`)
    }

    for (const needle of check.mustContain) {
      if (!result.text.includes(needle)) {
        fail(`${check.name} is missing expected content: "${needle}"`)
      }
    }

    ok(`${check.name} is healthy (${url})`)
  }

  console.log("\n🎉 All checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
