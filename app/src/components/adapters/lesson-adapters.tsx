"use client"

import { AnnotatedVisual } from "@/components/ui/annotated-visual"
import { KnowledgeCheck } from "@/components/ui/knowledge-check"
import { VisualSequence } from "@/components/ui/visual-sequence"
import { resolveArtifactImageSrc } from "@/lib/artifacts/image-src"

import type { AdapterArgs } from "@/components/artifact-types"

export function renderAnnotatedVisual({ node, context }: AdapterArgs<"annotated-visual">) {
  return (
    <AnnotatedVisual
      {...node.props}
      src={resolveArtifactImageSrc(node.props.src, context.project, context.slug)}
    />
  )
}

export function renderKnowledgeCheck({ node }: AdapterArgs<"knowledge-check">) {
  return <KnowledgeCheck {...node.props} />
}

export function renderVisualSequence({
  node,
  context,
  renderNodes,
  nodePath,
}: AdapterArgs<"visual-sequence">) {
  return (
    <VisualSequence
      title={node.props.title}
      caption={node.props.caption}
      items={node.props.items}
      renderFrame={(index) => {
        const item = node.props.items[index]
        return renderNodes(
          item.nodes,
          context,
          `${nodePath}.props.items.${index}.nodes`,
        )
      }}
    />
  )
}
