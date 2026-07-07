import type { NodeIdentity } from "@/components/annotations"
import type { VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import { formatArtifactForAI } from "./formatter"
import type { AIColabComment, AIColabCommentTarget } from "./types"

export function buildArtifactTarget(): AIColabCommentTarget {
  return { kind: "artifact" }
}

export function buildNodeTarget(node: NodeIdentity): AIColabCommentTarget {
  return {
    kind: "node",
    nodePath: node.nodePath,
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    label: node.textSnippet,
  }
}

export function createAIColabComment(body: string, target: AIColabCommentTarget): AIColabComment {
  return {
    id: generateId(),
    target,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  }
}

export function addComment(
  comments: AIColabComment[],
  body: string,
  target: AIColabCommentTarget
): AIColabComment[] {
  const trimmed = body.trim()
  if (!trimmed) return comments
  return [...comments, createAIColabComment(trimmed, target)]
}

export function deleteComment(comments: AIColabComment[], id: string): AIColabComment[] {
  return comments.filter((c) => c.id !== id)
}

export interface CopyAIColabMarkdownOptions {
  spec: VisualArtifactSpec
  comments: AIColabComment[]
  filePath?: string
}

export async function copyAIColabMarkdown({
  spec,
  comments,
  filePath,
}: CopyAIColabMarkdownOptions): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard not available")
  }
  const markdown = formatArtifactForAI(spec, { comments, filePath })
  await navigator.clipboard.writeText(markdown)
  return markdown
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
