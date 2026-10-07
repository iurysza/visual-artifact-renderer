"use client"

import { useId, useState } from "react"

import type { AdapterArgs } from "@/components/artifact-types"
import { usePlanContext } from "@/components/plan/decision-answers"
import { cn } from "@/lib/utils"

export function renderDecision(args: AdapterArgs<"decision">) {
  return <DecisionCard {...args} />
}

function DecisionCard({ node }: AdapterArgs<"decision">) {
  const { id, question, mode = "single", options, allowOther } = node.props
  const plan = usePlanContext()
  const suggested = options.filter((option) => option.suggested).map((option) => option.id)
  const [localAnswer, setLocalAnswer] = useState<{ optionIds: string[]; other?: string; source: "suggested" | "reader" }>({
    optionIds: suggested,
    source: "suggested",
  })
  const answer = plan?.answers[id] ?? localAnswer
  const setAnswer = (optionIds: string[], other?: string) => {
    if (plan) plan.setAnswer(id, optionIds, other)
    else setLocalAnswer({ optionIds, other, source: "reader" })
  }
  const index = plan ? plan.decisions.findIndex((decision) => decision.askId === id) : -1
  const heading = index >= 0 ? `Decision ${index + 1} of ${plan!.decisions.length}` : "Decision"
  const name = useId()
  const questionId = `${name}-q`
  const pending = answer.source === "suggested"
  const multiple = mode === "multiple"
  const choose = (optionId: string) => {
    if (!multiple) return setAnswer([optionId], optionId === "other" ? answer.other : undefined)
    const next = answer.optionIds.includes(optionId) ? answer.optionIds.filter((x) => x !== optionId) : [...answer.optionIds, optionId]
    setAnswer(next, answer.other)
  }
  const all = allowOther ? [...options, { id: "other", label: "Other", consequence: undefined, suggested: false }] : options

  return (
    <fieldset
      className={cn("rounded-xl border bg-card p-4 sm:p-5", pending ? "border-clay/70" : "border-border")}
      data-decision={id}
      data-source={answer.source}
      aria-labelledby={questionId}
    >
      <legend className="sr-only">{question}</legend>
      <p className={cn("text-xs font-medium", pending ? "text-clay-dark dark:text-clay" : "text-muted-foreground")}>{heading}</p>
      <p id={questionId} className="mt-1 text-base font-semibold text-foreground">
        {question}
      </p>
      {pending && <p className="mt-1 text-xs text-muted-foreground">Using suggestion · confirm or change</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role={multiple ? "group" : "radiogroup"} aria-labelledby={questionId}>
        {all.map((option) => {
          const checked = answer.optionIds.includes(option.id)
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border bg-background/40 px-3 py-2.5 transition-colors hover:bg-muted",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                checked && "border-clay bg-clay/[0.07]",
              )}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => choose(option.id)}
                className="mt-1 size-4 shrink-0 accent-[var(--clay)]"
              />
              <span className="min-w-0">
                <span className="font-medium text-foreground">{option.label}</span>
                {option.suggested && <span className="ml-2 text-xs text-muted-foreground">Suggested</span>}
                {option.consequence && <span className="mt-0.5 block text-sm text-muted-foreground">{option.consequence}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {allowOther && answer.optionIds.includes("other") && (
        <input
          type="text"
          value={answer.other ?? ""}
          onChange={(event) => setAnswer(answer.optionIds, event.target.value)}
          placeholder="Your answer"
          aria-label={`Other answer for ${question}`}
          className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      )}
    </fieldset>
  )
}
