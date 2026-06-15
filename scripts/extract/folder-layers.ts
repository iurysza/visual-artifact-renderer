#!/usr/bin/env tsx
import { promises as fs } from "node:fs"
import type { Dirent } from "node:fs"
import path from "node:path"
import {
  createExtractorContext,
  ensureContextDirs,
  makeAsset,
  writePacket,
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

const MAX_DEPTH = 6
const MAX_FILES_PER_DIR = 30

interface FolderNode {
  name: string
  path: string
  children: FolderNode[]
  fileCount: number
  dirCount: number
}

async function buildTree(repoRoot: string, relativeDir: string, depth: number): Promise<FolderNode> {
  const fullPath = path.join(repoRoot, relativeDir)
  const name = path.basename(relativeDir) || path.basename(repoRoot)
  const node: FolderNode = { name, path: relativeDir || ".", children: [], fileCount: 0, dirCount: 0 }

  let entries: Dirent[]
  try {
    entries = await fs.readdir(fullPath, { withFileTypes: true })
  } catch {
    return node
  }

  const dirs: FolderNode[] = []
  const files: string[] = []

  for (const entry of entries) {
    if (DEFAULT_IGNORE.has(entry.name) || entry.name.startsWith(".")) continue
    if (entry.isDirectory()) {
      dirs.push(await buildTree(repoRoot, path.join(relativeDir, entry.name), depth + 1))
    } else if (entry.isFile()) {
      files.push(entry.name)
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.localeCompare(b))

  if (depth >= MAX_DEPTH) {
    node.fileCount = files.length
    node.dirCount = dirs.length
    if (files.length > 0 || dirs.length > 0) {
      node.children.push({ name: `... ${files.length} files, ${dirs.length} dirs`, path: "", children: [], fileCount: files.length, dirCount: dirs.length })
    }
    return node
  }

  node.children.push(...dirs)

  if (files.length > MAX_FILES_PER_DIR) {
    node.children.push({ name: `... ${files.length - MAX_FILES_PER_DIR} more files`, path: "", children: [], fileCount: files.length - MAX_FILES_PER_DIR, dirCount: 0 })
    node.children.push(...files.slice(0, MAX_FILES_PER_DIR).map((fileName) => ({ name: fileName, path: path.join(relativeDir, fileName), children: [], fileCount: 0, dirCount: 0 })))
  } else {
    node.children.push(...files.map((fileName) => ({ name: fileName, path: path.join(relativeDir, fileName), children: [], fileCount: 0, dirCount: 0 })))
  }

  node.fileCount = files.length + dirs.reduce((sum, dir) => sum + dir.fileCount, 0)
  node.dirCount = dirs.length + dirs.reduce((sum, dir) => sum + dir.dirCount, 0)

  return node
}

function renderTree(node: FolderNode, prefix = ""): string {
  let result = prefix ? `${prefix}${node.name}\n` : `${node.name}\n`
  const children = node.children
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const isLast = i === children.length - 1
    const childPrefix = prefix ? `${prefix.replace(/├─ $/, "│ ").replace(/└─ $/, "  ")}` : ""
    result += renderTree(child, `${childPrefix}${isLast ? "└─ " : "├─ "}`)
  }
  return result
}

export async function runFolderLayersExtractor(repoRoot: string, slug: string, outputBase?: string): Promise<VisualArtifactReportPacket> {
  const context = createExtractorContext(repoRoot, slug, outputBase)
  await ensureContextDirs(context)

  const tree = await buildTree(repoRoot, "", 0)
  const treeText = renderTree(tree)
  const treeFileName = "folder-tree.txt"
  await writeText(assetPath(context, treeFileName), treeText)

  const topLevelDirs = tree.children
    .filter((child) => child.dirCount > 0 || child.children.length > 0)
    .map((child) => child.name)
    .slice(0, 12)

  await writePacket(context, {
    id: "folder-layers",
    kind: "folder-layers",
    title: "Folder layers",
    summary: `Pruned folder tree of ${slug}. Top-level areas: ${topLevelDirs.join(", ") || "none"}.`,
    instructionsSource: [".agents/plans/000-multipass-visual-artifact-generator/000-multipass-visual-artifact-generator.md"],
    facts: {
      topLevelDirectories: topLevelDirs,
      totalDirectories: tree.dirCount,
      totalFiles: tree.fileCount,
      maxDepth: MAX_DEPTH,
      maxFilesPerDir: MAX_FILES_PER_DIR,
    },
    findings: [
      {
        title: `Top-level structure: ${topLevelDirs.join(", ") || "flat"}`,
        evidence: [treeFileName],
        whyItMatters: "Top-level folders reveal how the project is organized and where different concerns live.",
        confidence: "high",
      },
    ],
    assets: [
      makeAsset(context, treeFileName, "text", "Pruned folder tree", "Compact ASCII tree with hidden directories and large file lists pruned"),
    ],
    assemblyHints: [
      { section: "technical layers", suggestedNodeTypes: ["mermaid", "code-block"], priority: "secondary" },
    ],
  })

  const { readFile } = await import("node:fs/promises")
  const packetPath = path.join(context.packetsDir, "folder-layers.json")
  return JSON.parse(await readFile(packetPath, "utf8")) as VisualArtifactReportPacket
}

async function main() {
  const repoRoot = process.argv[2] ?? process.cwd()
  const slug = process.argv[3] ?? "folder-layers-test"
  const outputBase = process.argv[4]
  const packet = await runFolderLayersExtractor(repoRoot, slug, outputBase)
  console.log(JSON.stringify({ packetId: packet.id, outputDir: path.join(outputBase ?? path.join(process.cwd(), "ai-artifacts", "generated"), slug) }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
