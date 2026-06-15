#!/usr/bin/env tsx
import { spawnSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { artifactComponentManifest, artifactCompositionGuidance, artifactPatternExamples } from "../../src/lib/artifact-manifest"
import { VisualArtifactSpecSchema } from "../../src/lib/artifact-schema"
import { createExtractorContext, ensureContextDirs, writeJson } from "./lib/runner"

const SOURCE_INSTRUCTION_FILES = [
  ".agents/plans/000-multipass-visual-artifact-generator/000-multipass-visual-artifact-generator.md",
  ".agents/plans/000-multipass-visual-artifact-generator/idea.md",
  ".agents/plans/000-multipass-visual-artifact-generator/mental-model.md",
  ".agents/plans/000-multipass-visual-artifact-generator/code-base-report-guidelines.md",
  ".agents/plans/000-multipass-visual-artifact-generator/hotspot-audit-algorithm.md",
]

async function listFiles(dir: string, extension: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir)
    return entries
      .filter((entry) => entry.endsWith(extension))
      .sort()
      .map((entry) => path.join(dir, entry))
  } catch {
    return []
  }
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch {
    return null
  }
}

function toRepoRelative(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/")
}

function renderFileList(repoRoot: string, filePaths: string[]): string {
  if (filePaths.length === 0) return "- none found"
  return filePaths.map((filePath) => `- ${toRepoRelative(repoRoot, filePath)}`).join("\n")
}

function renderComponentPalette(): string {
  const componentList = artifactComponentManifest
    .map((entry) => `- ${entry.type}: ${entry.description}`)
    .join("\n")

  return [
    "## Composition guidance",
    artifactCompositionGuidance.map((item) => `- ${item}`).join("\n"),
    "",
    "## Pattern examples",
    JSON.stringify(artifactPatternExamples, null, 2),
    "",
    "## Available components",
    componentList,
  ].join("\n")
}

async function renderSourceContext(repoRoot: string): Promise<string> {
  const chunks: string[] = []

  for (const relativePath of SOURCE_INSTRUCTION_FILES) {
    const absolutePath = path.join(repoRoot, relativePath)
    const content = await readIfExists(absolutePath)
    if (!content) continue

    chunks.push(`## ${relativePath}\n\n${content.trim()}`)
  }

  return chunks.join("\n\n---\n\n")
}

function renderPrompt(input: {
  repoRoot: string
  slug: string
  specPath: string
  digestPath: string
  extractorRunPath: string
  packetPaths: string[]
  reportPaths: string[]
  reportDirectionJsonPath: string
  reportDirectionMarkdownPath: string
  visualizationStrategyPath: string
  sourceContext: string
  componentPalette: string
}) {
  return `You are the Final Artifact Assembler.

Your goal is to produce the final VisualArtifactSpec JSON and write it to a file.
DO NOT OUTPUT RAW JSON IN THE CHAT. YOU MUST WRITE THE JSON TO A FILE.

Write the final JSON spec to:
${input.specPath}

The artifact should be saved under the slug: "${input.slug}"

Read all the following context before generating the JSON payload:

1. Report Direction (What to say):
- ${toRepoRelative(input.repoRoot, input.reportDirectionJsonPath)}
- ${toRepoRelative(input.repoRoot, input.reportDirectionMarkdownPath)}

2. Visualization Strategy (How to say it):
- ${toRepoRelative(input.repoRoot, input.visualizationStrategyPath)}

3. Deterministic Evidence:
- ${toRepoRelative(input.repoRoot, input.digestPath)}
- ${toRepoRelative(input.repoRoot, input.extractorRunPath)}

4. Packet JSON files (Source data):
${renderFileList(input.repoRoot, input.packetPaths)}

5. Free-flow reports (Source context):
${renderFileList(input.repoRoot, input.reportPaths)}

6. Source instructions:
${SOURCE_INSTRUCTION_FILES.map((file) => `- ${file}`).join("\n")}

7. Artifact component palette & Schema constraints:
${input.componentPalette}

Source context / north star:
${input.sourceContext}

Requirements for the Final JSON Spec:
- Use only node types from the Artifact Component Palette.
- Put lists/tables of data into the \`data\` object and reference them using \`dataKey\`.
- Keep the narrative orientation-first. Do not build a remediation backlog.
- If unsure about a value, use evidence from the packets/reports.

Write the complete JSON to the file path above. Do not call create_visual_artifact; the parent agent will do that.
`
}

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

  const prompt = renderPrompt({
    repoRoot,
    slug,
    specPath,
    digestPath,
    extractorRunPath,
    packetPaths,
    reportPaths,
    reportDirectionJsonPath,
    reportDirectionMarkdownPath,
    visualizationStrategyPath,
    sourceContext,
    componentPalette,
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
