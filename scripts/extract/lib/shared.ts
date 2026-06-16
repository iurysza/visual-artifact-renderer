import { promises as fs } from "node:fs"
import path from "node:path"
import { artifactComponentManifest, artifactCompositionGuidance, artifactPatternExamples } from "../../../src/lib/artifact-manifest"
import { ARTIFACT_NODE_TYPES } from "../../../src/lib/artifact-schema"

export const SOURCE_INSTRUCTION_FILES = [
  ".agents/plans/000-multipass-visual-artifact-generator/000-multipass-visual-artifact-generator.md",
  ".agents/plans/000-multipass-visual-artifact-generator/idea.md",
  ".agents/plans/000-multipass-visual-artifact-generator/mental-model.md",
  ".agents/plans/000-multipass-visual-artifact-generator/code-base-report-guidelines.md",
  ".agents/plans/000-multipass-visual-artifact-generator/hotspot-audit-algorithm.md",
]

export function toRepoRelative(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/")
}

export function renderFileList(repoRoot: string, filePaths: string[]): string {
  if (filePaths.length === 0) return "- none found"
  return filePaths.map((filePath) => `- ${toRepoRelative(repoRoot, filePath)}`).join("\n")
}

export async function listFiles(dir: string, extension: string): Promise<string[]> {
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

export async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch {
    return null
  }
}

export async function renderSourceContext(repoRoot: string): Promise<string> {
  const chunks: string[] = []

  for (const relativePath of SOURCE_INSTRUCTION_FILES) {
    const absolutePath = path.join(repoRoot, relativePath)
    const content = await readIfExists(absolutePath)
    if (!content) continue

    chunks.push(`## ${relativePath}\n\n${content.trim()}`)
  }

  return chunks.join("\n\n---\n\n")
}

export function renderComponentPalette(): string {
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

export function renderArtifactNodeTypes(): string {
  return ARTIFACT_NODE_TYPES.join(", ")
}

export function renderSourceInstructionFiles(): string {
  return SOURCE_INSTRUCTION_FILES.map((file) => `- ${file}`).join("\n")
}
