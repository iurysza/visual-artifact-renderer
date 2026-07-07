import type { ArtifactNode, VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import {
  buildNodePath,
  childrenNodePath,
  tabItemNodePath,
  accordionItemNodePath,
  resolveNodePath,
} from "@/lib/artifacts/node-paths"
import type { AIColabComment, AIColabFormatOptions } from "./types"

export function formatArtifactForAI(
  spec: VisualArtifactSpec,
  options?: AIColabFormatOptions
): string {
  const comments = options?.comments ?? []
  if (comments.length === 0) return ""

  const filePath = options?.filePath ?? "<unknown artifact>"
  const idIndex = buildNodeIdIndex(spec)
  const { artifactComments, nodeComments, orphanedComments } = groupCommentsWithOrphans(
    comments,
    idIndex,
    spec
  )

  const json = JSON.stringify(spec, null, 2)
  const targetNodePaths = Array.from(nodeComments.keys())
  const ranges = findJsonLineRanges(json, targetNodePaths, ["title"])
  const titleRange = ranges.get("title")

  const lines: string[] = [
    "Markdown Annotations",
    "",
    "File:",
    filePath,
    "",
    "File Feedback",
    "",
    `I've reviewed this file and have ${comments.length} piece${
      comments.length === 1 ? "" : "s"
    } of feedback:`,
    "",
  ]

  let n = 1

  for (const comment of artifactComments) {
    const start = titleRange?.start ?? 1
    const end = titleRange?.end ?? 1
    lines.push(
      `${n++}. (lines ${start}-${end}) Feedback on: "${escapeQuote(spec.title ?? "unknown")}"`
    )
    lines.push("")
    lines.push(...prefixLines(comment.body))
    lines.push("")
  }

  const orderedPaths = collectNodePathsInOrder(spec)
  for (const path of orderedPaths) {
    const commentsForPath = nodeComments.get(path)
    if (!commentsForPath || commentsForPath.length === 0) continue
    const range = ranges.get(path)
    const node = resolveNodePath(spec, path)
    for (const comment of commentsForPath) {
      const label = resolveNodeLabel(node, comment)
      const start = range?.start ?? 1
      const end = range?.end ?? 1
      lines.push(`${n++}. (lines ${start}-${end}) Feedback on: "${escapeQuote(label)}"`)
      lines.push("")
      lines.push(...prefixLines(comment.body))
      lines.push("")
    }
  }

  for (const comment of orphanedComments) {
    const label =
      comment.target.kind === "node"
        ? comment.target.label ?? comment.target.nodeType ?? comment.target.nodePath ?? "unknown"
        : "unknown"
    lines.push(`${n++}. (lines 1-1) Feedback on: "${escapeQuote(label)}"`)
    lines.push("")
    lines.push(...prefixLines(comment.body))
    lines.push("")
  }

  lines.push("Please address the annotation feedback above.")
  return lines.join("\n")
}

function resolveNodeLabel(
  node: ArtifactNode | undefined,
  comment: AIColabComment
): string {
  if (node) {
    const label = inferLabel(node)
    if (label) return label
  }
  if (comment.target.kind === "node") {
    if (comment.target.label) return comment.target.label
    if (comment.target.nodeType) return comment.target.nodeType
    if (comment.target.nodePath) return comment.target.nodePath
  }
  return "unknown"
}

function prefixLines(body: string): string[] {
  return body.split("\n").map((line) => `| ${line}`)
}

function escapeQuote(value: string): string {
  return value.replace(/"/g, '\\"')
}

function collectNodePathsInOrder(spec: VisualArtifactSpec): string[] {
  const paths: string[] = []

  function walk(nodes: ArtifactNode[], prefix: string) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const nodePath = buildNodePath(prefix, i)
      paths.push(nodePath)

      if (node.type === "card" || node.type === "grid" || node.type === "section") {
        if (node.children) {
          walk(node.children, childrenNodePath(nodePath))
        }
      }

      if (node.type === "tabs") {
        const items = (node.props as { items?: { nodes: ArtifactNode[] }[] }).items
        if (items) {
          for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            walk(items[itemIndex].nodes, tabItemNodePath(nodePath, itemIndex))
          }
        }
      }

      if (node.type === "accordion") {
        const items = (node.props as { items?: { nodes: ArtifactNode[] }[] }).items
        if (items) {
          for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            walk(items[itemIndex].nodes, accordionItemNodePath(nodePath, itemIndex))
          }
        }
      }
    }
  }

  walk(spec.nodes, "nodes")
  return paths
}

interface JsonRange {
  start: number
  end: number
}

function findJsonLineRanges(
  json: string,
  targetObjectPaths: string[],
  targetValuePaths: string[] = []
): Map<string, JsonRange> {
  const ranges = new Map<string, JsonRange>()
  const targetObjects = new Set(targetObjectPaths)
  const targetValues = new Set(targetValuePaths)

  let i = 0
  let line = 1

  function skipWhitespace() {
    while (i < json.length) {
      const c = json[i]
      if (c === "\n") line++
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        i++
      } else {
        break
      }
    }
  }

  function parseString(): string {
    if (json[i] !== '"') return ""
    let result = ""
    i++
    while (i < json.length) {
      const c = json[i]
      if (c === "\\") {
        if (i + 1 < json.length) {
          result += json[i + 1]
          i += 2
        } else {
          i++
        }
      } else if (c === '"') {
        i++
        return result
      } else {
        if (c === "\n") line++
        result += c
        i++
      }
    }
    return result
  }

  function parseValue(path: string) {
    skipWhitespace()
    const c = json[i]
    if (c === '"') {
      if (targetValues.has(path)) {
        ranges.set(path, { start: line, end: line })
      }
      parseString()
    } else if (c === "{") {
      parseObject(path)
    } else if (c === "[") {
      parseArray(path)
    } else {
      if (targetValues.has(path)) {
        ranges.set(path, { start: line, end: line })
      }
      while (i < json.length && !",}]".includes(json[i]) && !"\n\r".includes(json[i])) {
        i++
      }
    }
  }

  function parseObject(path: string) {
    const startLine = line
    if (targetObjects.has(path)) {
      ranges.set(path, { start: startLine, end: startLine })
    }
    i++ // {

    skipWhitespace()
    if (json[i] === "}") {
      i++
      if (targetObjects.has(path)) {
        ranges.set(path, { start: startLine, end: line })
      }
      return
    }

    while (true) {
      skipWhitespace()
      const key = parseString()
      skipWhitespace()
      if (json[i] === ":") i++
      const valuePath = path ? `${path}.${key}` : key
      parseValue(valuePath)
      skipWhitespace()
      if (json[i] === ",") {
        i++
        continue
      }
      if (json[i] === "}") {
        i++
        break
      }
    }

    if (targetObjects.has(path)) {
      ranges.set(path, { start: startLine, end: line })
    }
  }

  function parseArray(path: string) {
    i++ // [
    skipWhitespace()
    if (json[i] === "]") {
      i++
      return
    }

    let index = 0
    while (true) {
      skipWhitespace()
      const valuePath = path ? `${path}.${index}` : `${index}`
      parseValue(valuePath)
      skipWhitespace()
      if (json[i] === ",") {
        i++
        index++
        continue
      }
      if (json[i] === "]") {
        i++
        return
      }
    }
  }

  parseValue("")
  return ranges
}

function inferLabel(node: ArtifactNode): string {
  const props = node.props as Record<string, unknown> | undefined
  if (!props) return ""

  let candidate: unknown

  switch (node.type) {
    case "image":
      candidate = props.alt
      break
    case "table":
    case "data-table":
    case "comparison-table":
      candidate = props.caption ?? props.dataKey
      break
    case "code-block":
    case "mermaid":
    case "svg-diagram":
      candidate = props.title
      break
    case "section":
      candidate = props.title
      break
    case "metric":
    case "stat-card":
      candidate = props.label
      break
    default:
      candidate = props.title ?? props.text ?? props.label ?? props.content
  }

  if (typeof candidate !== "string" || candidate.length === 0) return ""
  return candidate.length > 80 ? `${candidate.slice(0, 80)}...` : candidate
}

function buildNodeIdIndex(spec: VisualArtifactSpec): Map<string, string> {
  const index = new Map<string, string>()

  const walk = (nodes: ArtifactNode[], pathPrefix: string) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const nodePath = buildNodePath(pathPrefix, i)

      if (node.metadata?.id) {
        index.set(node.metadata.id, nodePath)
      }

      if (node.type === "card" || node.type === "grid" || node.type === "section") {
        if (node.children) {
          walk(node.children, childrenNodePath(nodePath))
        }
      }

      if (node.type === "tabs") {
        const items = (node.props as { items?: { nodes: ArtifactNode[] }[] }).items
        if (items) {
          for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            walk(items[itemIndex].nodes, tabItemNodePath(nodePath, itemIndex))
          }
        }
      }

      if (node.type === "accordion") {
        const items = (node.props as { items?: { nodes: ArtifactNode[] }[] }).items
        if (items) {
          for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            walk(items[itemIndex].nodes, accordionItemNodePath(nodePath, itemIndex))
          }
        }
      }
    }
  }

  walk(spec.nodes, "nodes")
  return index
}

function groupCommentsWithOrphans(
  comments: AIColabComment[],
  idIndex: Map<string, string>,
  spec: VisualArtifactSpec
): {
  artifactComments: AIColabComment[]
  nodeComments: Map<string, AIColabComment[]>
  orphanedComments: AIColabComment[]
} {
  const artifactComments: AIColabComment[] = []
  const nodeComments = new Map<string, AIColabComment[]>()
  const orphanedComments: AIColabComment[] = []

  for (const comment of comments) {
    if (comment.target.kind === "artifact") {
      artifactComments.push(comment)
      continue
    }

    let targetPath: string | undefined

    if (comment.target.nodeId && idIndex.has(comment.target.nodeId)) {
      targetPath = idIndex.get(comment.target.nodeId)
    } else if (comment.target.nodePath) {
      targetPath = comment.target.nodePath
    }

    if (targetPath && resolveNodePath(spec, targetPath)) {
      const list = nodeComments.get(targetPath) ?? []
      list.push(comment)
      nodeComments.set(targetPath, list)
    } else {
      orphanedComments.push(comment)
    }
  }

  return { artifactComments, nodeComments, orphanedComments }
}
