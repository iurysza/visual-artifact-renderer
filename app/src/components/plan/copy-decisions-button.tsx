"use client"

import { useState } from "react"
import { Check, ClipboardCopy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatDecisionsMarkdown } from "@/lib/plan/format-decisions"

import { usePlanContext } from "./decision-answers"

export function CopyDecisionsButton() {
  const plan = usePlanContext()
  const [state, setState] = useState<"idle" | "copied" | { fallback: string }>("idle")
  if (!plan || plan.decisions.length === 0) return null
  const copy = async () => {
    const text = formatDecisionsMarkdown(plan.title, plan.decisions, plan.answers)
    try {
      await navigator.clipboard.writeText(text)
      setState("copied")
      setTimeout(() => setState("idle"), 1800)
    } catch {
      setState({ fallback: text })
    }
  }
  return (
    <div className="flex flex-col items-start gap-2" data-plan-copy>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {state === "copied" ? <Check data-icon="inline-start" /> : <ClipboardCopy data-icon="inline-start" />}
        {state === "copied" ? "Copied" : "Copy decisions as Markdown"}
      </Button>
      {typeof state === "object" && (
        <div className="w-full space-y-1">
          <p className="text-xs text-muted-foreground">Clipboard is blocked here. Copy the text below.</p>
          <textarea readOnly value={state.fallback} rows={Math.min(10, plan.decisions.length + 2)} className="w-full rounded-md border bg-muted p-2 font-mono text-xs" />
        </div>
      )}
    </div>
  )
}
