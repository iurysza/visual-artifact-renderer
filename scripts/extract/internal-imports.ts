#!/usr/bin/env tsx
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  createExtractorContext,
  ensureContextDirs,
  makeAsset,
  writePacket,
  writeJson,
  writeText,
  assetPath,
} from "./lib/runner"
import type { VisualArtifactReportPacket } from "../../src/lib/report-packet"

const DEFAULT_IGNORE = new Set([
  ".git",
  ".next",
  "node_modules",
  "out",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".turbo",
  ".vercel",
  ".netlify",
  "storybook-static",
])

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"])

interface ImportEdge {
  from: string
  to: string
  source: string
  resolved?: string
}

function isSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return SOURCE_EXTENSIONS.has(ext)
}

async function findSourceFiles(repoRoot: string, dir = ""): Promise<string[]> {
  const fullPath = path.join(repoRoot, dir)
  const entries = await fs.readdir(fullPath, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    if (DEFAULT_IGNORE.has(entry.name) || entry.name.startsWith(".")) continue
    const relativePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findSourceFiles(repoRoot, relativePath))
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      files.push(relativePath)
    }
  }
  return files
}

function extractImports(content: string): string[] {
  const imports: string[] = []

  // ES imports: import ... from "..." or import "..."
  const esImportRe = /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = esImportRe.exec(content)) !== null) {
    imports.push(match[1])
  }

  // CommonJS requires
  const cjsRequireRe = /require\s*\(\s*["']([^"']+)["']\s*\)/g
  while ((match = cjsRequireRe.exec(content)) !== null) {
    imports.push(match[1])
  }

  // Dynamic imports
  const dynamicImportRe = /import\s*\(\s*["']([^"']+)["']\s*\)/g
  while ((match = dynamicImportRe.exec(content)) !== null) {
    imports.push(match[1])
  }

  return imports
}

function resolveImport(repoRoot: string, sourcePath: string, importPath: string): string | null {
  // Only resolve internal (non-package) imports
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) return null

  const sourceDir = path.dirname(sourcePath)
  let resolved = importPath.startsWith("/")
    ? path.join(repoRoot, importPath)
    : path.resolve(repoRoot, sourceDir, importPath)

  // Try common extensions and index files
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${resolved}.mjs`,
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
    path.join(resolved, "index.jsx"),
  ]

  for (const candidate of candidates) {
    const relative = path.relative(repoRoot, candidate)
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      try {
        const stat = fs.stat(candidate)
        if (stat.then(s => s.isFile())) return relative.replace(/\\/g, "/")
      } catch {
        // continue
      }
    }
  }

  return importPath
}

function isInternalImport(importPath: string): boolean {
  return importPath.startsWith(".") || importPath.startsWith("/")
}

function isPackageImport(importPath: string): boolean {
  return !isInternalImport(importPath)
}

const IGNORED_PREFIXES = ["node_modules/", ".next/", "out/", "dist/", "build/", "coverage/", ".cache/", ".turbo/", ".vercel/", ".netlify/"]

function isIgnoredPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/")
  return IGNORED_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))
}

function moduleName(filePath: string): string {
  // Group by top-level directory or file name for graph nodes
  const parts = filePath.split("/")
  if (parts.length === 1) return parts[0]
  return parts[0]
}

function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$&")
}

function buildDependencyGraph(edges: ImportEdge[], maxNodes = 30): string {
  const moduleEdges = new Map<string, Set<string>>()
  for (const edge of edges) {
    const fromModule = moduleName(edge.from)
    const toModule = moduleName(edge.resolved ?? edge.to)
    if (fromModule === toModule) continue
    if (!moduleEdges.has(fromModule)) moduleEdges.set(fromModule, new Set())
    moduleEdges.get(fromModule)!.add(toModule)
  }

  // Keep nodes that have the most connections
  const nodeDegrees = new Map<string, number>()
  for (const [from, toSet] of moduleEdges) {
    nodeDegrees.set(from, (nodeDegrees.get(from) ?? 0) + toSet.size)
    for (const to of toSet) {
      nodeDegrees.set(to, (nodeDegrees.get(to) ?? 0) + 1)
    }
  }

  const topNodes = Array.from(nodeDegrees.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxNodes)
    .map(([name]) => name)

  const nodeSet = new Set(topNodes)

  const lines: string[] = []
  lines.push("graph TD")
  for (const node of topNodes) {
    lines.push(`  ${sanitizeMermaidId(node)}["${node}"]`)
  }

  const renderedEdges = new Set<string>()
  for (const [from, toSet] of moduleEdges) {
    if (!nodeSet.has(from)) continue
    for (const to of toSet) {
      if (!nodeSet.has(to)) continue
      const edgeKey = `${from}→${to}`
      if (renderedEdges.has(edgeKey)) continue
      renderedEdges.add(edgeKey)
      lines.push(`  ${sanitizeMermaidId(from)} --> ${sanitizeMermaidId(to)}`)
    }
  }

  return lines.join("\n")
}

export async function runInternalImportsExtractor(repoRoot: string, slug: string, outputBase?: string): Promise<VisualArtifactReportPacket> {
  const context = createExtractorContext(repoRoot, slug, outputBase)
  await ensureContextDirs(context)

  const sourceFiles = await findSourceFiles(repoRoot)
  const edges: ImportEdge[] = []
  const packageImports = new Map<string, number>()

  for (const sourcePath of sourceFiles) {
    const fullPath = path.join(repoRoot, sourcePath)
    const content = await fs.readFile(fullPath, "utf8").catch(() => "")
    const imports = extractImports(content)
    for (const importPath of imports) {
      if (isInternalImport(importPath)) {
        const resolved = await (async () => {
          const candidates = [
            path.resolve(repoRoot, path.dirname(sourcePath), importPath),
            path.resolve(repoRoot, importPath),
          ]
          for (const candidate of candidates) {
            const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs"]
            const indexFiles = ["index.ts", "index.tsx", "index.js", "index.jsx"]
            for (const ext of extensions) {
              const fullCandidate = `${candidate}${ext}`
              try {
                const stat = await fs.stat(fullCandidate)
                if (stat.isFile()) {
                  const relative = path.relative(repoRoot, fullCandidate).replace(/\\/g, "/")
                  if (relative.startsWith("..") || relative.startsWith("node_modules/")) return null
                  return relative
                }
              } catch {
                // continue
              }
            }
            for (const indexFile of indexFiles) {
              const fullCandidate = path.join(candidate, indexFile)
              try {
                const stat = await fs.stat(fullCandidate)
                if (stat.isFile()) {
                  const relative = path.relative(repoRoot, fullCandidate).replace(/\\/g, "/")
                  if (relative.startsWith("..") || relative.startsWith("node_modules/")) return null
                  return relative
                }
              } catch {
                // continue
              }
            }
          }
          return null
        })()

        if (!resolved || isIgnoredPath(resolved)) continue
        const fromPath = sourcePath.replace(/\\/g, "/")
        if (isIgnoredPath(fromPath)) continue
        edges.push({ from: fromPath, to: importPath, source: sourcePath, resolved })
      } else {
        const packageName = importPath.startsWith("@")
          ? importPath.split("/").slice(0, 2).join("/")
          : importPath.split("/")[0] ?? importPath
        packageImports.set(packageName, (packageImports.get(packageName) ?? 0) + 1)
      }
    }
  }

  const internalImportsJson = "internal-imports.json"
  await writeJson(assetPath(context, internalImportsJson), {
    fileCount: sourceFiles.length,
    internalEdgeCount: edges.length,
    edges: edges.slice(0, 500),
  })

  const dependencyGraphMmd = "dependency-graph.mmd"
  const mermaidGraph = buildDependencyGraph(edges)
  await writeText(assetPath(context, dependencyGraphMmd), mermaidGraph)

  const topInternalTargets = edges
    .reduce((acc, edge) => {
      const target = edge.resolved ?? edge.to
      acc.set(target, (acc.get(target) ?? 0) + 1)
      return acc
    }, new Map<string, number>())

  const topTargets = Array.from(topInternalTargets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([target, count]) => ({ target, count }))

  const topPackages = Array.from(packageImports.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pkg, count]) => ({ package: pkg, count }))

  await writePacket(context, {
    id: "internal-imports",
    kind: "dependency-graph",
    title: "Internal import graph",
    summary: `Extracted ${edges.length} internal import edges from ${sourceFiles.length} source files. Top internal target: ${topTargets[0]?.target ?? "none"}.`,
    instructionsSource: [".agents/plans/000-multipass-visual-artifact-generator/000-multipass-visual-artifact-generator.md"],
    facts: {
      sourceFileCount: sourceFiles.length,
      internalEdgeCount: edges.length,
      topInternalTargets: topTargets,
      topPackageImports: topPackages,
    },
    findings: [
      {
        title: `${edges.length} internal import edges across ${sourceFiles.length} files`,
        evidence: [internalImportsJson, dependencyGraphMmd],
        whyItMatters: "Import relationships reveal coupling, layering, and which modules are central to the architecture.",
        confidence: "high",
      },
    ],
    assets: [
      makeAsset(context, internalImportsJson, "json", "Internal import edges", "First 500 internal import edges with source and resolved target"),
      makeAsset(context, dependencyGraphMmd, "mermaid", "Dependency graph", "Top modules by internal import connectivity"),
    ],
    assemblyHints: [
      { section: "technical layers", suggestedNodeTypes: ["mermaid"], priority: "primary" },
      { section: "integration points", suggestedNodeTypes: ["data-table"], priority: "secondary" },
    ],
  })

  const packetPath = path.join(context.packetsDir, "internal-imports.json")
  const raw = await fs.readFile(packetPath, "utf8")
  return JSON.parse(raw) as VisualArtifactReportPacket
}

async function main() {
  const repoRoot = process.argv[2] ?? process.cwd()
  const slug = process.argv[3] ?? "internal-imports-test"
  const outputBase = process.argv[4]
  const packet = await runInternalImportsExtractor(repoRoot, slug, outputBase)
  console.log(JSON.stringify({ packetId: packet.id, outputDir: path.join(outputBase ?? path.join(process.cwd(), "ai-artifacts", "generated"), slug) }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
