#!/usr/bin/env tsx
import { spawnSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { VisualArtifactSpecSchema } from "../../../../src/lib/artifact-schema"
import { createExtractorContext, ensureContextDirs, writeJson } from "../../lib/runner"
import {
  listFiles,
  renderFileList,
  renderSourceContext,
  renderComponentPalette,
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
  const reportDirectionJsonPath = path.join(context.outputDir, "report-direction.json")
  const reportDirectionMarkdownPath = path.join(context.outputDir, "report-direction.md")
  const visualizationStrategyPath = path.join(context.outputDir, "visualization-strategy.md")
  const specPath = path.join(context.outputDir, "visual-artifact-spec.json")
  const packetPaths = await listFiles(context.packetsDir, ".json")
  const reportPaths = await listFiles(context.reportsDir, ".md")
  const sourceContext = await renderSourceContext(repoRoot)
  const componentPalette = renderComponentPalette()

  const promptPath = path.join(path.dirname(import.meta.url).replace("file://", ""), "prompt.md")
  const prompt = await loadAndRenderPrompt(promptPath, {
    specPath,
    slug,
    reportDirectionJsonPathRelative: toRepoRelative(repoRoot, reportDirectionJsonPath),
    reportDirectionMarkdownPathRelative: toRepoRelative(repoRoot, reportDirectionMarkdownPath),
    visualizationStrategyPathRelative: toRepoRelative(repoRoot, visualizationStrategyPath),
    digestPathRelative: toRepoRelative(repoRoot, digestPath),
    extractorRunPathRelative: toRepoRelative(repoRoot, extractorRunPath),
    packetPaths: renderFileList(repoRoot, packetPaths),
    reportPaths: renderFileList(repoRoot, reportPaths),
    sourceInstructionFiles: renderSourceInstructionFiles(),
    componentPalette,
    sourceContext,
  })

  console.error(`Running final assembler for ${slug}...`)

  const result = spawnSync("pi", ["--print", prompt], {
    cwd: repoRoot,
    stdio: "inherit",
    timeout: 20 * 60 * 1000,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Final assembler failed with exit code ${result.status ?? "unknown"}`)
  }

  const rawSpec = await fs.readFile(specPath, "utf8")
  const parsed = JSON.parse(rawSpec)
  const validated = VisualArtifactSpecSchema.parse(parsed)
  await writeJson(specPath, validated)

  console.log(JSON.stringify({
    slug,
    status: "success",
    visualArtifactSpecPath: toRepoRelative(repoRoot, specPath),
    message: "Final assembler pass complete. JSON spec validated and written.",
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
