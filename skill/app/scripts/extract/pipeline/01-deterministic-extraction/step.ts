#!/usr/bin/env tsx
import path from "node:path"
import type { VisualArtifactReportPacket } from "../../../../src/lib/report-packet"
import { runRepoProfileExtractor } from "./extractors/repo-profile"
import { runFolderLayersExtractor } from "./extractors/folder-layers"
import { runInternalImportsExtractor } from "./extractors/internal-imports"
import { runPackageDepsExtractor } from "./extractors/package-deps"
import { createExtractorContext, ensureContextDirs, writeJson, writeText } from "../../lib/runner"

type ProbeDefinition = {
  id: string
  description: string
}

type ExtractorRunManifest = {
  slug: string
  repoRoot: string
  outputDir: string
  generatedAt: string
  invocation: {
    script: string
    args: string[]
  }
  probes: ProbeDefinition[]
  packets: Array<{
    id: string
    kind: VisualArtifactReportPacket["kind"]
    title: string
    summary: string
    packetPath: string
    reportPath: string
    assetPaths: string[]
    findingCount: number
    codeSnippetCount: number
  }>
  packetPaths: string[]
  reportPaths: string[]
  assetPaths: string[]
  deterministicDigestPath: string
  extractorRunPath: string
}

const PROBES: ProbeDefinition[] = [
  {
    id: "repo-profile",
    description: "package manager, framework, scripts, dependencies, entry points, tests, routes",
  },
  {
    id: "folder-layers",
    description: "pruned folder tree, top-level directories, file/dir counts",
  },
  {
    id: "internal-imports",
    description: "source files, internal import edges, package import counts, Mermaid dependency graph",
  },
  {
    id: "package-deps",
    description: "declared dependencies grouped by purpose with usage counts from imports",
  },
]

function toRelative(outputDir: string, filePath: string): string {
  return path.relative(outputDir, filePath).replace(/\\/g, "/")
}

function packetPath(outputDir: string, packetId: string): string {
  return toRelative(outputDir, path.join(outputDir, "packets", `${packetId}.json`))
}

function reportPath(outputDir: string, packetId: string): string {
  return toRelative(outputDir, path.join(outputDir, "reports", `${packetId}.md`))
}

function markdownTable(rows: string[][]): string[] {
  if (rows.length === 0) return []
  const escape = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ")
  const [header, ...body] = rows
  return [
    `| ${header.map(escape).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ]
}

function renderDigest(manifest: ExtractorRunManifest, packets: VisualArtifactReportPacket[]): string {
  const lines: string[] = []
  lines.push(`# Deterministic extractor digest: ${manifest.slug}`)
  lines.push("")
  lines.push("This digest is optimized for the next LLM pass. It batches cheap deterministic repo probes into one read target so later report workflows do not need to make many exploratory tool calls.")
  lines.push("")
  lines.push("## Output index")
  lines.push("")
  lines.push(`- Output directory: \`${manifest.outputDir}\``)
  lines.push(`- Run manifest: \`${manifest.extractorRunPath}\``)
  lines.push(`- Packet count: ${manifest.packets.length}`)
  lines.push(`- Asset count: ${manifest.assetPaths.length}`)
  lines.push("")

  lines.push("## Probe bundle")
  lines.push("")
  lines.push(...markdownTable([
    ["Probe", "Deterministic data collected"],
    ...manifest.probes.map((probe) => [probe.id, probe.description]),
  ]))
  lines.push("")

  lines.push("## Packets")
  lines.push("")
  lines.push(...markdownTable([
    ["Packet", "Kind", "Summary", "Report"],
    ...manifest.packets.map((packet) => [packet.id, packet.kind, packet.summary, packet.reportPath]),
  ]))
  lines.push("")

  const findings = packets.flatMap((packet) => packet.findings.map((finding) => ({ packet, finding })))
  if (findings.length > 0) {
    lines.push("## Findings for report workflows")
    lines.push("")
    lines.push(...markdownTable([
      ["Packet", "Finding", "Confidence", "Risk", "Evidence"],
      ...findings.map(({ packet, finding }) => [
        packet.id,
        finding.title,
        finding.confidence,
        finding.changeRisk ?? "n/a",
        finding.evidence.slice(0, 4).join(", "),
      ]),
    ]))
    lines.push("")
  }

  const assets = packets.flatMap((packet) => packet.assets.map((asset) => ({ packet, asset })))
  if (assets.length > 0) {
    lines.push("## Generated assets")
    lines.push("")
    lines.push(...markdownTable([
      ["Packet", "Asset", "Type", "Path"],
      ...assets.map(({ packet, asset }) => [packet.id, asset.title, asset.type, asset.path]),
    ]))
    lines.push("")
  }

  const unresolved = packets.flatMap((packet) => (packet.unresolvedQuestions ?? []).map((question) => ({ packet, question })))
  if (unresolved.length > 0) {
    lines.push("## Unresolved questions")
    lines.push("")
    for (const { packet, question } of unresolved) {
      lines.push(`- **${packet.id}:** ${question}`)
    }
    lines.push("")
  }

  lines.push("## Report Director reminder")
  lines.push("")
  lines.push("Use this digest as evidence packaging, not as a final report structure. The Report Director owns thesis, emphasis, artifact type, section order, and packet-to-section mapping before section passes run.")
  lines.push("")

  return `${lines.join("\n").trim()}\n`
}

async function main() {
  const repoRoot = path.resolve(process.argv[2] ?? process.cwd())
  const slug = process.argv[3] ?? path.basename(repoRoot)
  const outputBase = process.argv[4]
  const context = createExtractorContext(repoRoot, slug, outputBase)
  await ensureContextDirs(context)

  console.error(`Running deterministic extractor batch for ${slug}...`)

  const packets = await Promise.all([
    runRepoProfileExtractor(repoRoot, slug, outputBase),
    runFolderLayersExtractor(repoRoot, slug, outputBase),
    runInternalImportsExtractor(repoRoot, slug, outputBase),
    runPackageDepsExtractor(repoRoot, slug, outputBase),
  ])

  const packetSummaries = packets.map((packet) => ({
    id: packet.id,
    kind: packet.kind,
    title: packet.title,
    summary: packet.summary,
    packetPath: packetPath(context.outputDir, packet.id),
    reportPath: reportPath(context.outputDir, packet.id),
    assetPaths: packet.assets.map((asset) => asset.path),
    findingCount: packet.findings.length,
    codeSnippetCount: packet.codeSnippets.length,
  }))

  const manifest: ExtractorRunManifest = {
    slug,
    repoRoot,
    outputDir: context.outputDir,
    generatedAt: new Date().toISOString(),
    invocation: {
      script: "scripts/extract/pipeline/01-deterministic-extraction/step.ts",
      args: process.argv.slice(2),
    },
    probes: PROBES,
    packets: packetSummaries,
    packetPaths: packetSummaries.map((packet) => packet.packetPath),
    reportPaths: packetSummaries.map((packet) => packet.reportPath),
    assetPaths: Array.from(new Set(packetSummaries.flatMap((packet) => packet.assetPaths))).sort(),
    deterministicDigestPath: "extractor-digest.md",
    extractorRunPath: "extractor-run.json",
  }

  await writeJson(path.join(context.outputDir, manifest.extractorRunPath), manifest)
  await writeText(path.join(context.outputDir, manifest.deterministicDigestPath), renderDigest(manifest, packets))

  console.log(JSON.stringify({
    slug,
    outputDir: context.outputDir,
    deterministicDigestPath: manifest.deterministicDigestPath,
    extractorRunPath: manifest.extractorRunPath,
    packetIds: packets.map((packet) => packet.id),
    packetKinds: packets.map((packet) => packet.kind),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
