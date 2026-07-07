"use client"

import { NodePickHUD as NodePickHUDShell } from "@/components/panel-shell/node-pick-hud"
import { useAIColabContext } from "@/components/ai-colab/ai-colab-provider"

export function AIColabHUD() {
  const ctx = useAIColabContext()
  const candidate = ctx.pickCandidateNode

  return (
    <NodePickHUDShell
      isPicking={ctx.isPickingNode}
      domIdPrefix="ai-colab-pick"
      hasCandidate={candidate != null}
      onConfirm={() => ctx.confirmNodePick()}
      onStop={() => ctx.stopNodePick()}
    >
      <div>
        {!candidate ? (
          <>
            <p className="text-sm font-medium">Select component</p>
            <p className="text-xs text-muted-foreground">
              Tap a component to select it. Scroll freely.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Comment on</p>
            <p className="text-xs text-muted-foreground">
              {candidate.textSnippet ?? candidate.nodeType ?? "Selected component"}
            </p>
          </>
        )}
      </div>
    </NodePickHUDShell>
  )
}