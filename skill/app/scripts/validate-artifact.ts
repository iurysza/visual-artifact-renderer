#!/usr/bin/env tsx
import { readFile } from "fs/promises"
import path from "path"

import { VisualArtifactSpecSchema } from "../src/lib/artifact-schema"

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error("Usage: tsx scripts/validate-artifact.ts <path-to-artifact.json>")
    process.exit(1)
  }

  const raw = await readFile(filePath, "utf8")
  const parsed = JSON.parse(raw)
  const result = VisualArtifactSpecSchema.safeParse(parsed)

  if (!result.success) {
    console.error("Invalid artifact spec:")
    console.error(result.error.format())
    process.exit(1)
  }

  const expectedFileName = `${result.data.slug}.json`
  const actualFileName = path.basename(filePath)
  if (expectedFileName !== actualFileName) {
    console.error(`Slug/filename mismatch: slug is "${result.data.slug}" but file is "${actualFileName}"`)
    process.exit(1)
  }

  console.log("Valid artifact spec:", result.data.title ?? result.data.slug)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
