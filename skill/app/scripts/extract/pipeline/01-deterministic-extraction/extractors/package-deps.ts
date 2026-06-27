#!/usr/bin/env tsx
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  createExtractorContext,
  ensureContextDirs,
  makeAsset,
  writePacket,
  writeJson,
  assetPath,
} from "../../../lib/runner"
import type { VisualArtifactReportPacket } from "../../../../../src/lib/report-packet"

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"])

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
])

interface PackageGroup {
  name: string
  packages: string[]
}

const GROUP_DEFINITIONS: PackageGroup[] = [
  { name: "framework", packages: ["next", "react", "react-dom", "vue", "svelte", "angular"] },
  { name: "ui", packages: ["@base-ui/react", "@radix-ui/react", "class-variance-authority", "clsx", "tailwind-merge", "tailwindcss", "tw-animate-css", "lucide-react", "vaul", "sonner"] },
  { name: "data-viz", packages: ["mermaid", "recharts"] },
  { name: "forms", packages: ["react-day-picker", "date-fns"] },
  { name: "testing", packages: ["jsdom", "@types/jsdom"] },
  { name: "styling", packages: ["tailwindcss", "@tailwindcss/postcss", "postcss"] },
  { name: "validation", packages: ["zod"] },
  { name: "highlighting", packages: ["shiki"] },
  { name: "themes", packages: ["next-themes"] },
]

async function findSourceFiles(repoRoot: string, dir = ""): Promise<string[]> {
  const fullPath = path.join(repoRoot, dir)
  const entries = await fs.readdir(fullPath, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    if (DEFAULT_IGNORE.has(entry.name) || entry.name.startsWith(".")) continue
    const relativePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findSourceFiles(repoRoot, relativePath))
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(relativePath)
    }
  }
  return files
}

function extractImports(content: string): string[] {
  const imports: string[] = []
  const esImportRe = /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = esImportRe.exec(content)) !== null) {
    imports.push(match[1])
  }
  const cjsRequireRe = /require\s*\(\s*["']([^"']+)["']\s*\)/g
  while ((match = cjsRequireRe.exec(content)) !== null) {
    imports.push(match[1])
  }
  return imports
}

function packageName(importPath: string): string {
  if (importPath.startsWith("@")) {
    return importPath.split("/").slice(0, 2).join("/")
  }
  return importPath.split("/")[0] ?? importPath
}

function groupForPackage(pkg: string): string {
  for (const group of GROUP_DEFINITIONS) {
    if (group.packages.includes(pkg)) return group.name
  }
  return "other"
}

async function readPackageJson(repoRoot: string) {
  try {
    const content = await fs.readFile(path.join(repoRoot, "package.json"), "utf8")
    return JSON.parse(content) as {
      name?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
  } catch {
    return null
  }
}

export async function runPackageDepsExtractor(repoRoot: string, slug: string, outputBase?: string): Promise<VisualArtifactReportPacket> {
  const context = createExtractorContext(repoRoot, slug, outputBase)
  await ensureContextDirs(context)

  const packageJson = await readPackageJson(repoRoot)
  const allDeps: Record<string, { version: string; kind: "dependency" | "devDependency" | "peerDependency"; usageCount: number }> = {}

  if (packageJson) {
    for (const [name, version] of Object.entries(packageJson.dependencies ?? {})) {
      allDeps[name] = { version, kind: "dependency", usageCount: 0 }
    }
    for (const [name, version] of Object.entries(packageJson.devDependencies ?? {})) {
      allDeps[name] = { version, kind: "devDependency", usageCount: 0 }
    }
    for (const [name, version] of Object.entries(packageJson.peerDependencies ?? {})) {
      allDeps[name] = { version, kind: "peerDependency", usageCount: 0 }
    }
  }

  const sourceFiles = await findSourceFiles(repoRoot)
  const usageCounts = new Map<string, number>()

  for (const sourcePath of sourceFiles) {
    const content = await fs.readFile(path.join(repoRoot, sourcePath), "utf8").catch(() => "")
    const imports = extractImports(content)
    for (const importPath of imports) {
      if (importPath.startsWith(".") || importPath.startsWith("/")) continue
      const pkg = packageName(importPath)
      usageCounts.set(pkg, (usageCounts.get(pkg) ?? 0) + 1)
    }
  }

  for (const [pkg, count] of usageCounts) {
    if (allDeps[pkg]) {
      allDeps[pkg].usageCount = count
    }
  }

  const grouped = new Map<string, { packages: string[]; totalUsage: number }>()
  for (const [pkg, info] of Object.entries(allDeps)) {
    const group = groupForPackage(pkg)
    if (!grouped.has(group)) grouped.set(group, { packages: [], totalUsage: 0 })
    const entry = grouped.get(group)!
    entry.packages.push(pkg)
    entry.totalUsage += info.usageCount
  }

  const groupedArray = Array.from(grouped.entries())
    .map(([group, { packages, totalUsage }]) => ({ group, packages: packages.sort(), totalUsage }))
    .sort((a, b) => b.totalUsage - a.totalUsage)

  const packageDepsJson = "package-deps.json"
  await writeJson(assetPath(context, packageDepsJson), {
    totalPackages: Object.keys(allDeps).length,
    grouped: groupedArray,
    packages: Object.entries(allDeps)
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.usageCount - a.usageCount),
  })

  const topGroups = groupedArray.slice(0, 5)

  await writePacket(context, {
    id: "package-deps",
    kind: "dependency-graph",
    title: "Package dependency groups",
    summary: `Grouped ${Object.keys(allDeps).length} declared packages. Top groups: ${topGroups.map(g => `${g.group} (${g.packages.length})`).join(", ") || "none"}.`,
    facts: {
      totalPackages: Object.keys(allDeps).length,
      topGroups: topGroups.map(g => ({ group: g.group, count: g.packages.length, totalUsage: g.totalUsage })),
      mostUsedPackages: Object.entries(allDeps)
        .sort((a, b) => b[1].usageCount - a[1].usageCount)
        .slice(0, 10)
        .map(([name, info]) => ({ name, usageCount: info.usageCount, kind: info.kind })),
    },
    findings: [
      {
        title: `${Object.keys(allDeps).length} declared packages across ${groupedArray.length} groups`,
        evidence: [packageDepsJson],
        confidence: "high",
      },
    ],
    assets: [
      makeAsset(context, packageDepsJson, "json", "Package dependency groups", "Declared packages grouped by purpose with usage counts from source imports"),
    ],
  })

  const packetPath = path.join(context.packetsDir, "package-deps.json")
  const raw = await fs.readFile(packetPath, "utf8")
  return JSON.parse(raw) as VisualArtifactReportPacket
}

async function main() {
  const repoRoot = process.argv[2] ?? process.cwd()
  const slug = process.argv[3] ?? "package-deps-test"
  const outputBase = process.argv[4]
  const packet = await runPackageDepsExtractor(repoRoot, slug, outputBase)
  console.log(JSON.stringify({ packetId: packet.id, outputDir: path.join(outputBase ?? path.join(process.cwd(), "ai-artifacts", "generated"), slug) }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
