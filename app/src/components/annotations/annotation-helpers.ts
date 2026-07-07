import type { AnnotationAnchor, AnnotationThread } from "@/lib/artifacts/annotations"

export interface NodeIdentity {
  nodeId?: string
  nodePath: string
  nodeType?: string
  textSnippet?: string
}

export function nodeIdentityMatches(
  anchor: AnnotationAnchor,
  nodeId: string | undefined,
  nodePath: string
): boolean {
  if (anchor.nodeId && nodeId) {
    return anchor.nodeId === nodeId
  }
  return anchor.nodePath === nodePath
}

export function threadNodeIdentity(thread: AnnotationThread): NodeIdentity {
  return {
    nodeId: thread.anchor.nodeId,
    nodePath: thread.anchor.nodePath,
  }
}

export function getThreadsForNode(
  threads: AnnotationThread[],
  nodeId: string | undefined,
  nodePath: string
): AnnotationThread[] {
  return threads.filter((thread) => nodeIdentityMatches(thread.anchor, nodeId, nodePath))
}

export function getThreadCount(
  threads: AnnotationThread[],
  nodeId: string | undefined,
  nodePath: string
): number {
  return getThreadsForNode(threads, nodeId, nodePath).length
}

export function cssEscape(value: string): string {
  if (typeof window !== "undefined" && "CSS" in window && window.CSS.escape) {
    return window.CSS.escape(value)
  }
  return value.replace(/(["'\\])/g, "\\$1")
}

export function findAnchorElement(nodeId: string | undefined, nodePath: string): Element | null {
  if (typeof document === "undefined") return null
  const selector = nodeId
    ? `[data-va-node-id="${cssEscape(nodeId)}"]`
    : `[data-va-node-path="${cssEscape(nodePath)}"]`
  return document.querySelector(selector)
}

export function isAnchorOrphaned(nodeId: string | undefined, nodePath: string): boolean {
  return !findAnchorElement(nodeId, nodePath)
}

export function scrollToNode(
  nodeId: string | undefined,
  nodePath: string,
): void {
  if (typeof document === "undefined") return
  const element = findAnchorElement(nodeId, nodePath)
  if (!element) return
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  element.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "center",
  })
}
