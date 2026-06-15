#!/usr/bin/env tsx
import { spawnSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { ARTIFACT_NODE_TYPES } from "../../src/lib/artifact-schema"
import { ReportDirectionBriefSchema } from "../../src/lib/report-direction"
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
  return filePaths.map((filePath) => `- ${toRepoRelative(repoRoot, filePath)}`).join("\n")
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
  sourceContext: string
  digestPath: string
  extractorRunPath: string
  packetPaths: string[]
  reportPaths: string[]
  jsonPath: string
  markdownPath: string
}) {
  const nodeTypes = ARTIFACT_NODE_TYPES.join(", ")

  return `Use the subagent tool to launch exactly one scout agent as the Report Director.

The scout agent's job is NOT to solve the codebase or produce a remediation backlog.
The job is to decide how the final visual report should INFORM a reader:
- What is this project?
- What are its main moving parts?
- Which components, flows, boundaries, and concepts should a reader understand first?
- Where should attention go when navigating the codebase?
- What evidence supports that orientation?

Hard framing rules:
- Orientation first. Do not lead with issues, fixes, refactors, or "what to do next".
- "Attention area" means "important place to understand", not "bad code".
- Recommendations, if any, are a short trailing section. They must not drive the artifact structure.
- Prefer: purpose, system map, domain concepts, important components, runtime/data flows, boundaries, verification confidence, attention areas.
- Avoid generic code-quality report shape. Use the packets to choose what this specific project needs explained.
- Do not emit a final VisualArtifactSpec. Do not call create_visual_artifact.

Repository root:
${input.repoRoot}

Read these source instructions and evidence files yourself before writing:

Source instruction files:
${SOURCE_INSTRUCTION_FILES.map((file) => `- ${file}`).join("\n")}

Deterministic digest:
- ${toRepoRelative(input.repoRoot, input.digestPath)}

Extractor run manifest:
- ${toRepoRelative(input.repoRoot, input.extractorRunPath)}

Packet JSON files:
${renderFileList(input.repoRoot, input.packetPaths)}

Free-flow agentic reports:
${renderFileList(input.repoRoot, input.reportPaths)}

Supported artifact node types for suggestedNodeTypes:
${nodeTypes}

Use these source instructions as the north star:

${input.sourceContext}

Write two files:
1. JSON director brief: ${input.jsonPath}
2. Human-readable storyboard: ${input.markdownPath}

The JSON must match this exact shape:

{
  "id": "report-direction",
  "thesis": "one concrete sentence about what the report teaches",
  "intendedArtifact": "code-architecture",
  "audience": "who this is for",
  "reportMode": "orientation-first",
  "emphasis": ["short emphasis strings"],
  "sectionOrder": ["section-id-in-display-order"],
  "sections": [
    {
      "id": "stable-kebab-id",
      "title": "Reader-facing section title",
      "purpose": "What this section helps the reader understand, not what it fixes",
      "readerQuestion": "Question answered by this section",
      "sourcePacketIds": ["packet-id"],
      "suggestedNodeTypes": ["heading", "text", "stat-card"],
      "dataKeys": ["optional-data-key"],
      "codeSnippetIds": ["optional-snippet-id"]
    }
  ],
  "risksAndCaveats": ["evidence limitations or uncertainty"],
  "unresolvedQuestions": ["optional concise questions"]
}

Storyboard markdown guidance:
- Start with the thesis.
- Then list the artifact sections in order.
- For each section, explain what the reader learns and which packets support it.
- Keep "what to do next" minimal or absent.
- Use neutral language. No blame, no generic "bad code" framing.
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
  const packetPaths = await listFiles(context.packetsDir, ".json")
  const reportPaths = await listFiles(context.reportsDir, ".md")
  const sourceContext = await renderSourceContext(repoRoot)
  const jsonPath = path.join(context.outputDir, "report-direction.json")
  const markdownPath = path.join(context.outputDir, "report-direction.md")

  const prompt = renderPrompt({
    repoRoot,
    slug,
    sourceContext,
    digestPath,
    extractorRunPath,
    packetPaths,
    reportPaths,
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
