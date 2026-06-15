#!/usr/bin/env tsx
import { spawnSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { artifactComponentManifest, artifactCompositionGuidance, artifactPatternExamples } from "../../src/lib/artifact-manifest"
import { createExtractorContext, ensureContextDirs } from "./lib/runner"

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
  digestPath: string
  extractorRunPath: string
  packetPaths: string[]
  reportPaths: string[]
  reportDirectionJsonPath: string
  reportDirectionMarkdownPath: string
  outputPath: string
  sourceContext: string
  componentPalette: string
}) {
  return `Use the subagent tool to launch exactly one scout agent as a Visualization Art Director.

This is a thinking/planning pass, not deterministic assembly.
Do not write JSON. Do not emit a final VisualArtifactSpec. Do not call create_visual_artifact.
Write one open-ended Markdown brief to:
${input.outputPath}

The brief should tell the final tool-calling assembler how to visualize the report direction.
The assembler will later receive all packets, reports, the director brief, this visualization strategy, and the artifact manifest, then generate the actual component JSON.

Core intent:
- The final artifact should inform, not become a remediation backlog.
- Explain what this project is, what matters, where to look, and how pieces relate.
- Use visual structure to help the reader build a mental model quickly.
- Attention areas should read as "places worth understanding", not "bad code".
- Recommendations should be small and trailing, if present at all.

Read these first:

Report direction:
- ${toRepoRelative(input.repoRoot, input.reportDirectionJsonPath)}
- ${toRepoRelative(input.repoRoot, input.reportDirectionMarkdownPath)}

Deterministic evidence:
- ${toRepoRelative(input.repoRoot, input.digestPath)}
- ${toRepoRelative(input.repoRoot, input.extractorRunPath)}

Packet JSON files:
${renderFileList(input.repoRoot, input.packetPaths)}

Free-flow reports:
${renderFileList(input.repoRoot, input.reportPaths)}

Source instructions:
${SOURCE_INSTRUCTION_FILES.map((file) => `- ${file}`).join("\n")}

Artifact component palette:
${input.componentPalette}

Source context / north star:
${input.sourceContext}

Write Markdown with this loose shape. Adapt if the evidence suggests a better structure:

# Visualization Strategy

## Visual thesis
One paragraph on what the page should help the reader understand.

## Composition approach
How the artifact should feel and scan: orientation-first, evidence-backed, not a wall of prose, not card soup.

## Opening section
How to open the artifact: thesis, summary band, first diagram/table/card set. Explain why.

## Section-by-section visual treatment
For each Report Director section:
- What the reader should learn
- Best component ideas to use (examples: text, stat-card, status-grid, comparison-table, mermaid, flow, timeline, code-block, tabs, accordion)
- What evidence/data should be surfaced
- What should stay out of the main path
- Any diagram idea in plain language if useful

## Data and evidence to expose
Loose notes on tables, status grids, metrics, captions, source references, and useful data keys. Do not force exact schemas.

## Component palette guidance
Which components should dominate and which should be used sparingly.

## Assembly instructions for the final tool-calling LLM
Direct instructions the assembler can follow when generating the final VisualArtifactSpec.

Important style rules:
- Prefer concrete visual decisions over generic advice.
- Do not tell the reader what to fix first unless it belongs in a small final section.
- Do not invent facts beyond the packets/reports.
- Keep the brief useful to another LLM, not beautiful for humans.
- If a visual idea is uncertain, say what evidence would resolve it.
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
  const outputPath = path.join(context.outputDir, "visualization-strategy.md")
  const packetPaths = await listFiles(context.packetsDir, ".json")
  const reportPaths = await listFiles(context.reportsDir, ".md")
  const sourceContext = await renderSourceContext(repoRoot)
  const componentPalette = renderComponentPalette()

  const prompt = renderPrompt({
    repoRoot,
    slug,
    digestPath,
    extractorRunPath,
    packetPaths,
    reportPaths,
    reportDirectionJsonPath,
    reportDirectionMarkdownPath,
    outputPath,
    sourceContext,
    componentPalette,
  })

  console.error(`Running visualization strategy pass for ${slug}...`)

  const result = spawnSync("pi", ["--print", prompt], {
    cwd: repoRoot,
    stdio: "inherit",
    timeout: 20 * 60 * 1000,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Visualization strategy pass failed with exit code ${result.status ?? "unknown"}`)
  }

  const content = await fs.readFile(outputPath, "utf8")
  if (content.trim().length < 200) {
    throw new Error(`Visualization strategy looks too short: ${outputPath}`)
  }

  console.log(JSON.stringify({
    slug,
    visualizationStrategyPath: toRepoRelative(repoRoot, outputPath),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
