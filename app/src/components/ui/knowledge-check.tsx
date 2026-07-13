"use client"

import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toneSurfaceClass } from "@/lib/artifacts/status"
import { cn } from "@/lib/utils"

export type KnowledgeCheckChoice = {
  id: string
  label: string
  feedback?: string
}

export type KnowledgeCheckProps = {
  prompt: string
  choices: KnowledgeCheckChoice[]
  answerId: string
  explanation: string
  hint?: string
}

export function KnowledgeCheck({
  prompt,
  choices,
  answerId,
  explanation,
  hint,
}: KnowledgeCheckProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const id = useId()
  const feedbackId = `${id}-feedback`
  const selectedChoice = choices.find((choice) => choice.id === selectedId)
  const isCorrect = submitted && selectedId === answerId

  return (
    <section className="rounded-xl border bg-card px-4 py-5 sm:px-5" aria-label="Knowledge check">
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (selectedId) setSubmitted(true)
        }}
      >
        <div className="flex flex-col gap-1">
          <h3 className="font-serif text-2xl font-medium tracking-[-0.02em]">
            Knowledge check
          </h3>
          <p className="text-sm text-muted-foreground">Choose one answer, then check your reasoning.</p>
        </div>

        <fieldset className="flex min-w-0 flex-col gap-4">
          <legend className="max-w-[70ch] text-balance text-lg font-medium leading-7">
            {prompt}
          </legend>

          {hint && (
            <details className="text-sm text-muted-foreground">
              <summary className="w-fit cursor-pointer font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
                Show hint
              </summary>
              <p className="mt-2 max-w-[70ch] leading-6">{hint}</p>
            </details>
          )}

          <RadioGroup
            value={selectedId ?? ""}
            disabled={submitted}
            aria-invalid={submitted && !isCorrect ? true : undefined}
            aria-describedby={submitted ? feedbackId : undefined}
            onValueChange={(value) => setSelectedId(value)}
          >
            {choices.map((choice, index) => {
              const choiceControlId = `${id}-choice-${index}`
              const isSelected = choice.id === selectedId

              return (
                <div
                  key={choice.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors",
                    !submitted && "hover:bg-muted/60",
                    isSelected && "border-foreground/35 bg-muted",
                  )}
                >
                  <RadioGroupItem
                    id={choiceControlId}
                    value={choice.id}
                    aria-invalid={submitted && isSelected && !isCorrect ? true : undefined}
                  />
                  <Label htmlFor={choiceControlId} className="min-w-0 flex-1 cursor-pointer items-start leading-6">
                    <span className="break-words">{choice.label}</span>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        </fieldset>

        {submitted && (
          <div
            id={feedbackId}
            role="status"
            aria-live="polite"
            className={cn(
              "rounded-lg border px-3 py-3",
              toneSurfaceClass(isCorrect ? "success" : "warning"),
            )}
          >
            <p className="font-medium text-foreground">{isCorrect ? "Correct" : "Not quite"}</p>
            {selectedChoice?.feedback && (
              <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">
                {selectedChoice.feedback}
              </p>
            )}
            <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">
              {explanation}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!submitted ? (
            <Button type="submit" disabled={!selectedId}>
              Check answer
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation()
                setSelectedId(null)
                setSubmitted(false)
              }}
            >
              Try again
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
