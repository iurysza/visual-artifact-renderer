import type { ArtifactNode, VisualArtifactSpec } from "@/lib/contract/artifact-schema"

export function buildNodePath(prefix: string, index: number): string {
  return `${prefix}.${index}`
}

export function childrenNodePath(parentPath: string): string {
  return `${parentPath}.children`
}

export function tabItemNodePath(parentPath: string, itemIndex: number): string {
  return `${parentPath}.props.items.${itemIndex}.nodes`
}

export function accordionItemNodePath(parentPath: string, itemIndex: number): string {
  return `${parentPath}.props.items.${itemIndex}.nodes`
}

export function sequenceItemNodePath(parentPath: string, itemIndex: number): string {
  return `${parentPath}.props.items.${itemIndex}.nodes`
}

export function resolveNodePath(spec: VisualArtifactSpec, nodePath: string): ArtifactNode | undefined {
  const segments = nodePath.split(".")
  let current: unknown = spec

  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined

    if (/^\d+$/.test(segment)) {
      if (!Array.isArray(current)) return undefined
      current = current[Number(segment)]
    } else {
      current = (current as Record<string, unknown>)[segment]
    }
  }

  return current as ArtifactNode | undefined
}
