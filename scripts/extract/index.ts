#!/usr/bin/env tsx
import path from "node:path"
import { runRepoProfileExtractor } from "./repo-profile"
import { runFolderLayersExtractor } from "./folder-layers"
import { runInternalImportsExtractor } from "./internal-imports"
import { runPackageDepsExtractor } from "./package-deps"

async function main() {
  const repoRoot = process.argv[2] ?? process.cwd()
  const slug = process.argv[3] ?? "visualizer"
  const outputBase = process.argv[4]

  console.error(`Running deterministic extractors for ${slug}...`)

  const packets = await Promise.all([
    runRepoProfileExtractor(repoRoot, slug, outputBase),
    runFolderLayersExtractor(repoRoot, slug, outputBase),
    runInternalImportsExtractor(repoRoot, slug, outputBase),
    runPackageDepsExtractor(repoRoot, slug, outputBase),
  ])

  const outputDir = path.join(outputBase ?? path.join(process.cwd(), "ai-artifacts", "generated"), slug)
  const result = {
    slug,
    outputDir,
    packetIds: packets.map((p) => p.id),
    packetKinds: packets.map((p) => p.kind),
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
