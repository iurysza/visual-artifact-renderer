import type { ReactNode } from "react"

import type { ArtifactNode, VisualArtifactSpec } from "@/lib/artifact-schema"

export type ArtifactRenderContext = {
  data: VisualArtifactSpec["data"]
}

export type RenderNodes = (
  nodes: ArtifactNode[] | undefined,
  context: ArtifactRenderContext
) => ReactNode

export type AdapterArgs<T extends ArtifactNode["type"]> = {
  node: Extract<ArtifactNode, { type: T }>
  children?: ReactNode
  context: ArtifactRenderContext
  renderNodes: RenderNodes
}

export type RegistryAdapter = (args: {
  node: ArtifactNode
  children?: ReactNode
  context: ArtifactRenderContext
  renderNodes: RenderNodes
}) => ReactNode
