// Pure helpers that read plan structure out of a spec. Node paths match the
// renderer's: "nodes.0.children.3", tabs/accordion "….props.items.1.nodes.0".
import type { ArtifactNode, VisualArtifactSpec } from "@/lib/contract/artifact-schema"

type SpecLike = Pick<VisualArtifactSpec, "nodes">

export type ClaimInfo = {
  nodePath: string
  /** "1.2", or "＊"/"—" for aux claims. */
  label: string
  /** Anchor-safe id, e.g. "claim-1-2". */
  anchor: string
  depth: number
  text: string
  parentPath?: string
  /** Decisions in this claim or any descendant claim. */
  decisionCount: number
}

export type DecisionInfo = { askId: string; nodePath: string; claimLabel?: string; node: Extract<ArtifactNode, { type: "decision" }> }

type Visit = (node: ArtifactNode, nodePath: string, claimPath: string | undefined) => void

function walk(nodes: readonly ArtifactNode[] | undefined, prefix: string, claimPath: string | undefined, visit: Visit) {
  nodes?.forEach((node, index) => {
    const nodePath = `${prefix}.${index}`
    visit(node, nodePath, claimPath)
    const nextClaim = node.type === "claim" ? nodePath : claimPath
    if ("children" in node && Array.isArray(node.children)) walk(node.children, `${nodePath}.children`, nextClaim, visit)
    if (node.type === "tabs" || node.type === "accordion") {
      node.props.items.forEach((item, itemIndex) => walk(item.nodes, `${nodePath}.props.items.${itemIndex}.nodes`, nextClaim, visit))
    }
  })
}

export function specHasPlanNodes(spec: SpecLike): boolean {
  let found = false
  walk(spec.nodes, "nodes", undefined, (node) => {
    if (node.type === "decision" || node.type === "claim" || node.type === "claim-tree") found = true
  })
  return found
}

/** Numbers every claim by position. aux claims are unnumbered. */
export function indexClaims(spec: SpecLike): Map<string, ClaimInfo> {
  const claims = new Map<string, ClaimInfo>()
  const number = (children: readonly ArtifactNode[] | undefined, prefix: string, parent: ClaimInfo | undefined) => {
    let counter = 0
    children?.forEach((child, index) => {
      if (child.type !== "claim") return
      const nodePath = `${prefix}.${index}`
      let label: string
      if (child.props.aux) label = child.props.aux === "shared" ? "＊" : "—"
      else {
        counter++
        label = parent ? `${parent.label}.${counter}` : `${counter}`
      }
      const slug = child.props.aux ? `${child.props.aux}-${nodePath.split(".").slice(1).join("-")}` : label.replace(/[^0-9]+/g, "-")
      const info: ClaimInfo = {
        nodePath,
        label,
        anchor: `claim-${slug}`,
        depth: parent ? parent.depth + 1 : 0,
        text: child.props.text,
        parentPath: parent?.nodePath,
        decisionCount: 0,
      }
      claims.set(nodePath, info)
      number(child.children, `${nodePath}.children`, info)
    })
  }
  walk(spec.nodes, "nodes", undefined, (node, nodePath) => {
    if (node.type === "claim-tree") number(node.children, `${nodePath}.children`, undefined)
  })
  walk(spec.nodes, "nodes", undefined, (node, _path, claimPath) => {
    if (node.type !== "decision") return
    let current = claimPath ? claims.get(claimPath) : undefined
    while (current) {
      current.decisionCount++
      current = current.parentPath ? claims.get(current.parentPath) : undefined
    }
  })
  return claims
}

/** Decisions in document order, with the claim that holds each. */
export function collectDecisions(spec: SpecLike, claims = indexClaims(spec)): DecisionInfo[] {
  const out: DecisionInfo[] = []
  walk(spec.nodes, "nodes", undefined, (node, nodePath, claimPath) => {
    if (node.type !== "decision") return
    out.push({ askId: node.props.id, nodePath, claimLabel: claimPath ? claims.get(claimPath)?.label : undefined, node })
  })
  return out
}

/** Claims that hold a decision themselves or in a descendant (decisions D10). Returns node paths. */
export function needsOpenSet(spec: SpecLike, claims = indexClaims(spec)): Set<string> {
  return new Set([...claims.values()].filter((claim) => claim.decisionCount > 0).map((claim) => claim.nodePath))
}

export type DecisionAnswer = { optionIds: string[]; other?: string; source: "suggested" | "reader" }
export type DecisionAnswers = Record<string, DecisionAnswer>

export function suggestedAnswers(decisions: readonly DecisionInfo[]): DecisionAnswers {
  return Object.fromEntries(
    decisions.map((decision) => [
      decision.askId,
      { optionIds: decision.node.props.options.filter((option) => option.suggested).map((option) => option.id), source: "suggested" as const },
    ]),
  )
}
