"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { QuizOption } from "./types"

export interface BalancedQuizProps {
  question: string
  options: QuizOption[]
  correctValue: string
  explanation: string
  onComplete?: (correct: boolean) => void
}

export function BalancedQuiz({
  question,
  options,
  correctValue,
  explanation,
  onComplete,
}: BalancedQuizProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const isCorrect = selected === correctValue

  function handleSubmit() {
    if (!selected) return
    setSubmitted(true)
    onComplete?.(isCorrect)
  }

  function handleReset() {
    setSelected(null)
    setSubmitted(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium leading-6">{question}</p>
      <RadioGroup
        value={selected ?? ""}
        onValueChange={(value) => {
          if (submitted) return
          setSelected(value)
        }}
      >
        <div className="flex flex-col gap-3">
          {options.map((option) => {
            const isSelected = selected === option.value
            const isCorrectOption = option.value === correctValue
            const showStatus = submitted && isSelected
            return (
              <label
                key={option.value}
                htmlFor={`quiz-${option.value}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition",
                  showStatus &&
                    isCorrectOption &&
                    "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/15",
                  showStatus &&
                    !isCorrectOption &&
                    "border-red-500/50 bg-red-50/50 dark:bg-red-950/15",
                  !showStatus && isSelected && "border-primary bg-muted/50",
                  !showStatus &&
                    !isSelected &&
                    "bg-background hover:bg-muted/35"
                )}
              >
                <RadioGroupItem id={`quiz-${option.value}`} value={option.value} />
                <span className="leading-6 text-muted-foreground">
                  {option.label}
                </span>
                {showStatus &&
                  (isCorrectOption ? (
                    <Check className="ml-auto size-4 text-emerald-600" />
                  ) : (
                    <X className="ml-auto size-4 text-red-600" />
                  ))}
              </label>
            )
          })}
        </div>
      </RadioGroup>

      {submitted && (
        <Alert variant={isCorrect ? "default" : "destructive"}>
          {isCorrect ? <Check /> : <X />}
          <AlertTitle>{isCorrect ? "Correct" : "Not quite"}</AlertTitle>
          <AlertDescription>{explanation}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        {submitted ? (
          <Button variant="outline" size="sm" onClick={handleReset}>
            Retry
          </Button>
        ) : (
          <Button size="sm" onClick={handleSubmit} disabled={!selected}>
            Check answer
          </Button>
        )}
      </div>
    </div>
  )
}
