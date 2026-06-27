#!/usr/bin/env tsx
import { spawnSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { ReportDirectionBriefSchema } from "../../../../src/lib/report-direction"
import { createExtractorContext, ensureContextDirs, writeJson } from "../../lib/runner"
import {
  listFiles,
  renderFileList,
  renderSourceContext,
  renderArtifactNodeTypes,
  renderSourceInstructionFiles,
  toRepoRelative,
} from "../../lib/shared"
import { loadAndRenderPrompt } from "../../lib/prompt"

async function main() {
  const repoRoot = path.resolve(process.argv[2] ?? process.cwd())
  const slug = process.argv[3] ?? path.basename(repoRoot)
  const outputBase = process.argv[4]
  const context = createExtractorContext(repoRoot, slug, outputBase)
  await ensureContextDirs(context)

  const digestPath = path.join(context.outputDir, "extractor-digest.md")
  const extractorRunPath = path.join(context.outputDir, "extractor-run.json")
  const packetPaths = await listFiles(context.packetsDir, ".json")
  const reportPaths = await listFiles(context.reportsDir, ".md")
  const sourceContext = await renderSourceContext(repoRoot)
  const jsonPath = path.join(context.outputDir, "report-direction.json")
  const markdownPath = path.join(context.outputDir, "report-direction.md")

  const promptPath = path.join(path.dirname(import.meta.url).replace("file://", ""), "prompt.md")
  const prompt = await loadAndRenderPrompt(promptPath, {
    repoRoot,
    sourceInstructionFiles: renderSourceInstructionFiles(),
    digestPathRelative: toRepoRelative(repoRoot, digestPath),
    extractorRunPathRelative: toRepoRelative(repoRoot, extractorRunPath),
    packetPaths: renderFileList(repoRoot, packetPaths),
    reportPaths: renderFileList(repoRoot, reportPaths),
    artifactNodeTypes: renderArtifactNodeTypes(),
    sourceContext,
    jsonPath,
    markdownPath,
  })

  console.error(`Running Report Director for ${slug}...`)

  const result = spawnSync("pi", ["--print", prompt], {
    cwd: repoRoot,
    stdio: "inherit",
    timeout: 20 * 60 * 1000,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Report Director failed with exit code ${result.status ?? "unknown"}`)
  }

  const rawJson = await fs.readFile(jsonPath, "utf8")
  const brief = ReportDirectionBriefSchema.parse(JSON.parse(rawJson))
  await fs.access(markdownPath)
  await writeJson(jsonPath, brief)

  console.log(JSON.stringify({
    slug,
    reportDirectionPath: toRepoRelative(repoRoot, jsonPath),
    reportDirectionMarkdownPath: toRepoRelative(repoRoot, markdownPath),
    sectionCount: brief.sections.length,
    sectionOrder: brief.sectionOrder,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
