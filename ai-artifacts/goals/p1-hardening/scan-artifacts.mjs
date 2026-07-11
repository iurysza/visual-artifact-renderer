#!/usr/bin/env node

import { readdir, readFile, realpath, stat } from "node:fs/promises"
import { basename, dirname, join, relative, resolve } from "node:path"

const root = resolve(process.argv[2] ?? "artifacts")
const projectRoot = resolve(root, "..")

async function findSpecs(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...await findSpecs(path))
    } else if (entry.name.endsWith(".json") && !["annotations.json", "publish.json"].includes(entry.name)) {
      const raw = await readFile(path, "utf8")
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.nodes)) {
          found.push({ path, raw, spec: parsed })
        }
      } catch {
        // Validation owns malformed JSON reporting; this scanner measures parseable saved specs.
      }
    }
  }
  return found
}

function childGroups(node) {
  const groups = []
  if (Array.isArray(node?.children)) groups.push(node.children)
  if ((node?.type === "tabs" || node?.type === "accordion") && Array.isArray(node?.props?.items)) {
    for (const item of node.props.items) {
      if (Array.isArray(item?.nodes)) groups.push(item.nodes)
    }
  }
  return groups
}

function measureNodes(nodes) {
  let total = 0
  let maxDepth = 0
  const stack = nodes.map((node) => ({ node, depth: 1 }))
  while (stack.length > 0) {
    const { node, depth } = stack.pop()
    total += 1
    maxDepth = Math.max(maxDepth, depth)
    for (const group of childGroups(node)) {
      for (const child of group) stack.push({ node: child, depth: depth + 1 })
    }
  }
  return { total, maxDepth }
}

function measureFileTreeItems(spec) {
  let total = 0
  let maxDepth = 0
  const sources = []
  const nodeStack = [...spec.nodes]
  while (nodeStack.length > 0) {
    const node = nodeStack.pop()
    for (const group of childGroups(node)) nodeStack.push(...group)
    if (node?.type !== "file-tree" || !Array.isArray(node?.props?.items)) continue
    const itemStack = node.props.items.map((item) => ({ item, depth: 1 }))
    while (itemStack.length > 0) {
      const { item, depth } = itemStack.pop()
      total += 1
      maxDepth = Math.max(maxDepth, depth)
      if (typeof item?.src === "string") sources.push(item.src)
      if (Array.isArray(item?.children)) {
        for (const child of item.children) itemStack.push({ item: child, depth: depth + 1 })
      }
    }
  }
  return { total, maxDepth, sources }
}

function largestString(value) {
  let bytes = 0
  const stack = [value]
  while (stack.length > 0) {
    const current = stack.pop()
    if (typeof current === "string") {
      bytes = Math.max(bytes, Buffer.byteLength(current))
    } else if (Array.isArray(current)) {
      stack.push(...current)
    } else if (current && typeof current === "object") {
      stack.push(...Object.values(current))
    }
  }
  return bytes
}

async function sourceFacts(sources) {
  const facts = []
  for (const source of sources) {
    const candidate = resolve(projectRoot, source)
    try {
      const canonical = await realpath(candidate)
      const info = await stat(canonical)
      facts.push({ source, canonical, bytes: info.size })
    } catch (error) {
      facts.push({ source, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return facts
}

const files = await findSpecs(root)
const artifacts = []
for (const { path, raw, spec } of files) {
  const nodes = measureNodes(spec.nodes)
  const fileTree = measureFileTreeItems(spec)
  artifacts.push({
    path: relative(projectRoot, path),
    slug: spec.slug,
    rawBytes: Buffer.byteLength(raw),
    datasetCount: spec.data && typeof spec.data === "object" && !Array.isArray(spec.data)
      ? Object.keys(spec.data).length
      : 0,
    topLevelNodes: spec.nodes.length,
    totalNodes: nodes.total,
    nodeDepth: nodes.maxDepth,
    fileTreeItems: fileTree.total,
    fileTreeDepth: fileTree.maxDepth,
    largestStringBytes: largestString(spec),
    sourcedFiles: await sourceFacts(fileTree.sources),
  })
}

const maxima = artifacts.reduce((result, artifact) => {
  for (const key of ["rawBytes", "datasetCount", "topLevelNodes", "totalNodes", "nodeDepth", "fileTreeItems", "fileTreeDepth", "largestStringBytes"]) {
    result[key] = Math.max(result[key], artifact[key])
  }
  return result
}, { rawBytes: 0, datasetCount: 0, topLevelNodes: 0, totalNodes: 0, nodeDepth: 0, fileTreeItems: 0, fileTreeDepth: 0, largestStringBytes: 0 })

console.log(JSON.stringify({ scannedRoot: root, artifactCount: artifacts.length, maxima, artifacts }, null, 2))
