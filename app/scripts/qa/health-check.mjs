#!/usr/bin/env node

/**
 * Smoke the routes served by the compiled visual-artifact CLI.
 * verify.sh creates the fixture and supplies its isolated server URL.
 */

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:9998/artifacts").replace(/\/$/, "")
const ARTIFACT_PROJECT = process.env.ARTIFACT_PROJECT || "health-project"
const ARTIFACT_SLUG = process.env.ARTIFACT_SLUG || "health-check"
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || "5000")

function route(path) {
  return `${BASE_URL}${path}`
}

async function fetchText(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const url = route(path)

  try {
    const response = await fetch(url, { signal: controller.signal })
    const text = await response.text()
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
    return { text, url }
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${url} timed out`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function checkText(name, path, expected) {
  const { text, url } = await fetchText(path)
  for (const value of expected) {
    if (!text.includes(value)) throw new Error(`${name} (${url}) is missing ${JSON.stringify(value)}`)
  }
  console.log(`PASS  ${name} — ${url}`)
}

async function checkJson(name, path, assertDocument) {
  const { text, url } = await fetchText(path)
  let document
  try {
    document = JSON.parse(text)
  } catch {
    throw new Error(`${name} (${url}) did not return JSON`)
  }
  assertDocument(document, url)
  console.log(`PASS  ${name} — ${url}`)
}

function requireEqual(actual, expected, label, url) {
  if (actual !== expected) {
    throw new Error(`${label} (${url}) expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

async function main() {
  const artifactPath = `/${ARTIFACT_PROJECT}/${ARTIFACT_SLUG}/`
  const dataPath = `/data/artifacts/${ARTIFACT_PROJECT}/${ARTIFACT_SLUG}`

  await checkText("home page", "/", ["<title>Artifacts</title>", "Loading index"])
  await checkText("artifact shell", artifactPath, ["Shell Artifact", "Loading artifact"])
  await checkJson("artifact data", `${dataPath}/artifact.json`, (document, url) => {
    requireEqual(document.slug, ARTIFACT_SLUG, "artifact slug", url)
    requireEqual(document.title, "Health Check Artifact", "artifact title", url)
  })
  await checkJson("annotation data", `${dataPath}/annotations.json`, (document, url) => {
    requireEqual(document.version, 1, "annotation version", url)
    requireEqual(document.project, ARTIFACT_PROJECT, "annotation project", url)
    requireEqual(document.slug, ARTIFACT_SLUG, "annotation slug", url)
  })
}

main().catch((error) => {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
