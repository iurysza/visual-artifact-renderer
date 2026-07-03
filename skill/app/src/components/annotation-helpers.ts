import type { AnnotationAnchor, AnnotationThread } from "@/lib/artifacts/annotations"

export interface NodeIdentity {
  nodeId?: string
  nodePath: string
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
