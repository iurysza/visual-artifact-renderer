import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { VisualArtifactReportPacketSchema, type VisualArtifactReportPacket, type VisualArtifactReportPacketInput, type ReportPacketAsset } from "../../../src/lib/report-packet"

export interface ExtractorContext {
  repoRoot: string
  outputDir: string
  slug: string
  packetsDir: string
  reportsDir: string
  assetsDir: string
}

export function createExtractorContext(repoRoot: string, slug: string, outputBase?: string): ExtractorContext {
  const outputDir = path.resolve(outputBase ?? path.join(process.cwd(), "ai-artifacts", "generated"), slug)
  return {
    repoRoot: path.resolve(repoRoot),
    outputDir,
    slug,
    packetsDir: path.join(outputDir, "packets"),
    reportsDir: path.join(outputDir, "reports"),
    assetsDir: path.join(outputDir, "assets"),
  }
}

export async function ensureContextDirs(context: ExtractorContext): Promise<void> {
  await fs.mkdir(context.packetsDir, { recursive: true })
  await fs.mkdir(context.reportsDir, { recursive: true })
  await fs.mkdir(context.assetsDir, { recursive: true })
}

export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8")
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, "utf8")
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

export async function readJson<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf8")
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export function expandHome(filePath: string): string {
  if (filePath.startsWith("~")) {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

export async function writePacket(
  context: ExtractorContext,
  packet: VisualArtifactReportPacketInput,
): Promise<void> {
  const normalizedPacket = VisualArtifactReportPacketSchema.parse(packet)
  const packetPath = path.join(context.packetsDir, `${normalizedPacket.id}.json`)
  await writeJson(packetPath, normalizedPacket)

  const reportPath = path.join(context.reportsDir, `${normalizedPacket.id}.md`)
  await writeText(reportPath, renderPacketMarkdown(normalizedPacket))
}

export function assetPath(context: ExtractorContext, fileName: string): string {
  return path.join(context.assetsDir, fileName)
}

export function relativeAssetPath(context: ExtractorContext, fileName: string): string {
  return path.relative(context.outputDir, assetPath(context, fileName))
}

function renderPacketMarkdown(packet: VisualArtifactReportPacket): string {
  const lines: string[] = []
  lines.push(`# ${packet.title}`)
  lines.push("")
  lines.push(packet.summary)
  lines.push("")

  if (packet.instructionsSource.length > 0) {
    lines.push("**Instructions source:** " + packet.instructionsSource.join(", "))
    lines.push("")
  }

  if (Object.keys(packet.facts).length > 0) {
    lines.push("## Facts")
    lines.push("")
    lines.push("```json")
    lines.push(JSON.stringify(packet.facts, null, 2))
    lines.push("```")
    lines.push("")
  }

  if (packet.findings.length > 0) {
    lines.push("## Findings")
    lines.push("")
    for (const finding of packet.findings) {
      lines.push(`### ${finding.title}`)
      lines.push("")
      lines.push("**Evidence:**")
      for (const evidence of finding.evidence) {
        lines.push(`- ${evidence}`)
      }
      lines.push("")
      lines.push(`**Why it matters:** ${finding.whyItMatters}`)
      if (finding.changeRisk) lines.push(`**Change risk:** ${finding.changeRisk}`)
      if (finding.testCoverage) lines.push(`**Test coverage:** ${finding.testCoverage}`)
      if (finding.suggestedNextStep) lines.push(`**Suggested next step:** ${finding.suggestedNextStep}`)
      lines.push(`**Confidence:** ${finding.confidence}`)
      lines.push("")
    }
  }

  if (packet.assets.length > 0) {
    lines.push("## Assets")
    lines.push("")
    for (const asset of packet.assets) {
      lines.push(`- **${asset.title}** (${asset.type}): ${asset.path}`)
      if (asset.description) lines.push(`  ${asset.description}`)
    }
    lines.push("")
  }

  if (packet.codeSnippets.length > 0) {
    lines.push("## Code snippets")
    lines.push("")
    for (const snippet of packet.codeSnippets) {
      lines.push(`### ${snippet.title}`)
      lines.push("")
      if (snippet.description) {
        lines.push(snippet.description)
        lines.push("")
      }
      if (snippet.path) {
        const lineRange = snippet.startLine ? `:${snippet.startLine}${snippet.endLine ? `-${snippet.endLine}` : ""}` : ""
        lines.push(`Source: \`${snippet.path}${lineRange}\``)
        lines.push("")
      }
      lines.push(`\`\`\`${snippet.language ?? "text"}`)
      lines.push(snippet.code)
      lines.push("```")
      lines.push("")
    }
  }

  if (packet.assemblyHints.length > 0) {
    lines.push("## Assembly hints")
    lines.push("")
    for (const hint of packet.assemblyHints) {
      lines.push(`- **${hint.section}** (${hint.priority}): ${hint.suggestedNodeTypes.join(", ")}`)
    }
    lines.push("")
  }

  if (packet.unresolvedQuestions && packet.unresolvedQuestions.length > 0) {
    lines.push("## Unresolved questions")
    lines.push("")
    for (const question of packet.unresolvedQuestions) {
      lines.push(`- ${question}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

export function makeAsset(context: ExtractorContext, fileName: string, type: ReportPacketAsset["type"], title: string, description?: string): ReportPacketAsset {
  return {
    type,
    path: relativeAssetPath(context, fileName),
    title,
    description,
  }
}
