"use client"

import { NodePickHUD as NodePickHUDShell } from "@/components/panel-shell/node-pick-hud"
import { useAnnotationContext } from "./annotation-provider"

export function NodePickHUD() {
  const ctx = useAnnotationContext()
  return (
    <NodePickHUDShell
      isPicking={ctx.isPickingNode}
      domIdPrefix="node-pick"
      hasCandidate={ctx.pickCandidateNode != null}
      onConfirm={() => ctx.confirmNodePick()}
      onStop={() => ctx.stopNodePick()}
    />
  )
}