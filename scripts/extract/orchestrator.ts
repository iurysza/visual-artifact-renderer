#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { execSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  createExtractorContext,
  ensureContextDirs,
  writeJson,
  writeText,
  writePacket,
  makeAsset,
} from "./lib/runner"
import type { VisualArtifactReportPacketInput } from "../../src/lib/report-packet"

interface ToolResult {
  tool: string
  command: string
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  outputPath?: string
}

function runTool(name: string, command: string, cwd?: string): ToolResult {
  const start = Date.now()
  let stdout = ""
  let stderr = ""
  let exitCode = 0
  try {
    stdout = execSync(command, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
  } catch (error: any) {
    stdout = error.stdout?.toString() ?? ""
    stderr = error.stderr?.toString() ?? ""
    exitCode = error.status ?? 1
  }
  return {
    tool: name,
    command,
    exitCode,
    stdout,
    stderr,
    durationMs: Date.now() - start,
  }
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function runDependencyCruiser(
  repoRoot: string,
  context: ReturnType<typeof createExtractorContext>,
): Promise<{ result: ToolResult; packet: VisualArtifactReportPacketInput }> {
  const outputFile = path.join(context.assetsDir, "dependency-cruiser.json")
  const cmd = `depcruise --no-config "src/**/*.{ts,tsx}" --output-type json > ${outputFile}`
  const result = runTool("dependency-cruiser", cmd, repoRoot)
  const data = parseJsonSafe(await fs.readFile(outputFile, "utf8").catch(() => "{}")) as any

  const allModules = data?.modules ?? []
  const summary = data?.summary ?? {}
  const violations = summary?.violations ?? []
  const totalCruised = summary?.totalCruised ?? 0

  // Filter to only project files (exclude node_modules)
  const modules = allModules.filter((m: any) => {
    const source = m.source ?? ""
    return !source.includes("node_modules/") && !source.startsWith("node_modules/")
  })

  const topModules = modules
    .sort((a: any, b: any) => (b.dependencies?.length ?? 0) - (a.dependencies?.length ?? 0))
    .slice(0, 10)
    .map((m: any) => ({
      source: m.source,
      dependencyCount: m.dependencies?.length ?? 0,
      dependentCount: m.dependents?.length ?? 0,
      circular: m.circular ?? false,
    }))

  const packet: VisualArtifactReportPacketInput = {
    id: "dependency-cruiser",
    kind: "dependency-graph",
    title: "Dependency graph from dependency-cruiser",
    summary: `Cruised ${totalCruised} total modules, ${modules.length} project modules. ${violations.length} violations. Top modules by dependency count: ${topModules.map((m: any) => m.source).join(", ") || "none"}.`,
    facts: {
      totalModules: totalCruised,
      projectModules: modules.length,
      violationCount: violations.length,
      topModules,
      circularModules: modules.filter((m: any) => m.circular).map((m: any) => m.source),
    },
    findings: [
      {
        title: `${totalCruised} modules cruised, ${violations.length} violations`,
        evidence: ["dependency-cruiser.json"],
        confidence: "high",
      },
    ],
    assets: [
      makeAsset(context, "dependency-cruiser.json", "json", "Dependency cruiser output", "Full module dependency graph with violations and summary"),
    ],
  }

  return { result, packet }
}

async function runKnip(
  repoRoot: string,
  context: ReturnType<typeof createExtractorContext>,
): Promise<{ result: ToolResult; packet: VisualArtifactReportPacketInput }> {
  const outputFile = path.join(context.assetsDir, "knip.json")
  const cmd = `knip --reporter json > ${outputFile}`
  const result = runTool("knip", cmd, repoRoot)
  const data = parseJsonSafe(await fs.readFile(outputFile, "utf8").catch(() => "{}")) as any

  const issues = data?.issues ?? []
  const unusedFiles = issues.filter((i: any) => i.files?.length > 0).flatMap((i: any) => i.files.map((f: any) => f.name))
  const unusedDeps = issues.filter((i: any) => i.dependencies?.length > 0).flatMap((i: any) => i.dependencies.map((d: any) => d.name))
  const unusedExports = issues.filter((i: any) => i.exports?.length > 0).flatMap((i: any) => i.exports.map((e: any) => `${e.name} (${i.file})`))

  const packet: VisualArtifactReportPacketInput = {
    id: "knip",
    kind: "repo-profile",
    title: "Unused code and dependencies from knip",
    summary: `Found ${unusedFiles.length} unused files, ${unusedDeps.length} unused dependencies, ${unusedExports.length} unused exports.`,
    facts: {
      unusedFiles: unusedFiles.slice(0, 20),
      unusedDependencies: unusedDeps.slice(0, 20),
      unusedExports: unusedExports.slice(0, 20),
      totalIssues: issues.length,
    },
    findings: [
      {
        title: `${unusedFiles.length} unused files, ${unusedDeps.length} unused deps, ${unusedExports.length} unused exports`,
        evidence: ["knip.json"],
        confidence: "high",
      },
    ],
    assets: [
      makeAsset(context, "knip.json", "json", "Knip output", "Unused files, dependencies, and exports"),
    ],
  }

  return { result, packet }
}

async function runAstGrep(
  repoRoot: string,
  context: ReturnType<typeof createExtractorContext>,
): Promise<{ result: ToolResult; packet: VisualArtifactReportPacketInput }> {
  const outputFile = path.join(context.assetsDir, "ast-grep.json")
  const patterns = [
    { name: "functions", pattern: "function $NAME($$$ARGS) { $$$BODY }" },
    { name: "arrow-functions", pattern: "const $NAME = ($$$ARGS) => { $$$BODY }" },
    { name: "hooks", pattern: "function $NAME() { $$$BODY }" },
  ]

  const allMatches: any[] = []
  const toolResults: ToolResult[] = []
  for (const { name, pattern } of patterns) {
    const cmd = `sg run -p '${pattern}' --json src > ${outputFile}.${name}`
    const result = runTool("ast-grep", cmd, repoRoot)
    toolResults.push(result)
    const data = parseJsonSafe(await fs.readFile(`${outputFile}.${name}`, "utf8").catch(() => "[]")) as any[]
    if (Array.isArray(data)) {
      allMatches.push(...data.map((m) => ({ ...m, patternName: name })))
    }
  }

  // Combine tool results into a single result
  const combinedResult: ToolResult = {
    tool: "ast-grep",
    command: `sg run (${patterns.length} patterns)`,
    exitCode: toolResults.every((r) => r.exitCode === 0) ? 0 : Math.max(...toolResults.map((r) => r.exitCode)),
    stdout: "",
    stderr: toolResults.map((r) => r.stderr).join("\n"),
    durationMs: toolResults.reduce((sum, r) => sum + r.durationMs, 0),
  }

  // Write combined output
  await writeJson(outputFile, allMatches)

  const functions = allMatches.filter((m) => m.patternName === "functions" || m.patternName === "arrow-functions")
  const hooks = allMatches.filter((m) => m.patternName === "hooks")
  const largeFunctions = functions
    .filter((m: any) => (m.text?.length ?? 0) > 500)
    .slice(0, 10)
    .map((m: any) => ({
      name: m.metaVariables?.single?.NAME?.text ?? "unknown",
      file: m.file,
      line: m.range?.start?.line ?? 0,
      size: m.text?.length ?? 0,
    }))

  const packet: VisualArtifactReportPacketInput = {
    id: "ast-grep",
    kind: "codebase-orientation",
    title: "AST patterns from ast-grep",
    summary: `Found ${functions.length} function declarations, ${hooks.length} hooks. ${largeFunctions.length} large functions (>500 chars).`,
    facts: {
      totalFunctions: functions.length,
      totalHooks: hooks.length,
      largeFunctions,
    },
    findings: [
      {
        title: `${largeFunctions.length} large functions detected`,
        evidence: largeFunctions.map((f: any) => `${f.name} at ${f.file}:${f.line}`),
        confidence: "medium",
      },
    ],
    assets: [
      makeAsset(context, "ast-grep.json", "json", "AST grep output", "Function declarations, hooks, and AST pattern matches"),
    ],
  }

  return { result: combinedResult, packet }
}

async function runJscpd(
  repoRoot: string,
  context: ReturnType<typeof createExtractorContext>,
): Promise<{ result: ToolResult; packet: VisualArtifactReportPacketInput }> {
  const outputFile = path.join(repoRoot, "report/jscpd-report.json")
  const cmd = `jscpd src --reporters json --min-lines 5 --min-tokens 50`
  const result = runTool("jscpd", cmd, repoRoot)
  const data = parseJsonSafe(await fs.readFile(outputFile, "utf8").catch(() => "{}")) as any

  const statistics = data?.statistics ?? {}
  const duplicates = data?.duplicates ?? []
  const totalLines = statistics?.total?.lines ?? 0
  const cloneLines = statistics?.total?.cloneLines ?? 0
  const percentage = totalLines > 0 ? ((cloneLines / totalLines) * 100).toFixed(1) : "0"

  const topDuplicates = duplicates
    .slice(0, 10)
    .map((d: any) => ({
      firstFile: d.firstFile?.name ?? "unknown",
      secondFile: d.secondFile?.name ?? "unknown",
      lines: d.lines ?? 0,
      tokens: d.tokens ?? 0,
    }))

  const packet: VisualArtifactReportPacketInput = {
    id: "jscpd",
    kind: "knowledge-duplication-audit",
    title: "Code duplication from jscpd",
    summary: `Found ${duplicates.length} duplicates. ${percentage}% of ${totalLines} lines are duplicated.`,
    facts: {
      totalDuplicates: duplicates.length,
      totalLines,
      cloneLines,
      percentage: `${percentage}%`,
      topDuplicates,
    },
    findings: [
      {
        title: `${duplicates.length} duplicated blocks (${percentage}% of lines)`,
        evidence: ["jscpd-report.json"],
        confidence: "high",
      },
    ],
    assets: [
      makeAsset(context, "jscpd-report.json", "json", "jscpd output", "Duplicated code blocks with file locations and line counts"),
    ],
  }

  return { result, packet }
}

async function runDifftastic(
  repoRoot: string,
  context: ReturnType<typeof createExtractorContext>,
): Promise<{ result: ToolResult; packet: VisualArtifactReportPacketInput }> {
  const outputFile = path.join(context.assetsDir, "difftastic.json")
  // Compare working tree against HEAD for structural changes
  const cmd = `DFT_DISPLAY=json DFT_UNSTABLE=yes difft HEAD -- src > ${outputFile}`
  const result = runTool("difftastic", cmd, repoRoot)
  const data = parseJsonSafe(await fs.readFile(outputFile, "utf8").catch(() => "{}")) as any

  const files = data?.files ?? []
  const changedFiles = files.filter((f: any) => f.status === "changed")
  const addedFiles = files.filter((f: any) => f.status === "added")
  const removedFiles = files.filter((f: any) => f.status === "removed")

  const topChanges = changedFiles
    .slice(0, 10)
    .map((f: any) => ({
      path: f.path,
      lhsChanges: f.lhs?.changes?.length ?? 0,
      rhsChanges: f.rhs?.changes?.length ?? 0,
    }))

  const packet: VisualArtifactReportPacketInput = {
    id: "difftastic",
    kind: "change-scenario-trace",
    title: "Structural diff from difftastic",
    summary: `${changedFiles.length} files changed, ${addedFiles.length} added, ${removedFiles.length} removed since HEAD.`,
    facts: {
      changedFiles: changedFiles.length,
      addedFiles: addedFiles.length,
      removedFiles: removedFiles.length,
      topChanges,
    },
    findings: [
      {
        title: `${changedFiles.length} files changed structurally since HEAD`,
        evidence: topChanges.map((c: any) => `${c.path} (${c.lhsChanges} → ${c.rhsChanges} changes)`),
        confidence: "high",
      },
    ],
    assets: [
      makeAsset(context, "difftastic.json", "json", "Difftastic output", "Structural diff with AST-level changes per file"),
    ],
  }

  return { result, packet }
}

function renderDigest(
  slug: string,
  toolResults: ToolResult[],
  packets: VisualArtifactReportPacketInput[],
): string {
  const lines: string[] = []
  lines.push(`# Deterministic extractor digest: ${slug}`)
  lines.push("")
  lines.push("This digest batches cheap deterministic repo probes from real static analysis tools into one read target.")
  lines.push("")
  lines.push("## Tool results")
  lines.push("")
  lines.push("| Tool | Exit code | Duration | Notes |")
  lines.push("|------|-----------|----------|-------|")
  for (const result of toolResults) {
    const notes = result.exitCode === 0 ? "OK" : `exit ${result.exitCode}`
    lines.push(`| ${result.tool} | ${result.exitCode} | ${result.durationMs}ms | ${notes} |`)
  }
  lines.push("")

  lines.push("## Packets")
  lines.push("")
  lines.push("| Packet | Kind | Summary |")
  lines.push("|--------|------|---------|")
  for (const packet of packets) {
    lines.push(`| ${packet.id} | ${packet.kind} | ${packet.summary} |`)
  }
  lines.push("")

  lines.push("## Report Director reminder")
  lines.push("")
  lines.push("Use this digest as evidence packaging, not as a final report structure. The Report Director owns thesis, emphasis, artifact type, section order, and packet-to-section mapping.")
  lines.push("")

  return lines.join("\n")
}

async function main() {
  const repoRoot = path.resolve(process.argv[2] ?? process.cwd())
  const slug = process.argv[3] ?? path.basename(repoRoot)
  const outputBase = process.argv[4]
  const context = createExtractorContext(repoRoot, slug, outputBase)
  await ensureContextDirs(context)

  console.error(`Running deterministic extractor pipeline for ${slug}...`)

  const toolResults: ToolResult[] = []
  const packets: VisualArtifactReportPacketInput[] = []

  // Core pipeline: dependency-cruiser, knip, ast-grep, jscpd
  const dc = await runDependencyCruiser(repoRoot, context)
  toolResults.push(dc.result)
  packets.push(dc.packet)
  await writePacket(context, dc.packet)

  const knip = await runKnip(repoRoot, context)
  toolResults.push(knip.result)
  packets.push(knip.packet)
  await writePacket(context, knip.packet)

  const ag = await runAstGrep(repoRoot, context)
  toolResults.push(ag.result)
  packets.push(ag.packet)
  await writePacket(context, ag.packet)

  const jscpd = await runJscpd(repoRoot, context)
  toolResults.push(jscpd.result)
  packets.push(jscpd.packet)
  await writePacket(context, jscpd.packet)

  // Secondary: difftastic for structural diff
  const diff = await runDifftastic(repoRoot, context)
  toolResults.push(diff.result)
  packets.push(diff.packet)
  await writePacket(context, diff.packet)

  // Write manifest
  const manifest = {
    slug,
    repoRoot,
    outputDir: context.outputDir,
    generatedAt: new Date().toISOString(),
    tools: toolResults.map((r) => ({
      tool: r.tool,
      command: r.command,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
    })),
    packetIds: packets.map((p) => p.id),
    packetPaths: packets.map((p) => `packets/${p.id}.json`),
  }

  await writeJson(path.join(context.outputDir, "extractor-run.json"), manifest)
  await writeText(path.join(context.outputDir, "extractor-digest.md"), renderDigest(slug, toolResults, packets))

  console.log(JSON.stringify({
    slug,
    outputDir: context.outputDir,
    packetIds: packets.map((p) => p.id),
    toolResults: toolResults.map((r) => ({ tool: r.tool, exitCode: r.exitCode, durationMs: r.durationMs })),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
