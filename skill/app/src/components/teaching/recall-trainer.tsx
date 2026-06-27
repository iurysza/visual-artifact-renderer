"use client"

import { useState } from "react"
import { Brain, Eye, Lightbulb } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"

export interface RecallTrainerProps {
  prompt: string
  answer: string
  hints?: string[]
  nextRep?: string
}

export function RecallTrainer({
  prompt,
  answer,
  hints = [],
  nextRep,
}: RecallTrainerProps) {
  const [revealed, setRevealed] = useState(false)
  const [hintIndex, setHintIndex] = useState(0)
  const [confidence, setConfidence] = useState<number | null>(null)

  const showHint = () => setHintIndex((i) => Math.min(i + 1, hints.length))
  const hasMoreHints = hintIndex < hints.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="size-5" />
          Recall check
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm font-medium leading-6">{prompt}</p>
        {hints.slice(0, hintIndex).map((hint, i) => (
          <Alert key={i}>
            <Lightbulb />
            <AlertTitle>Hint {i + 1}</AlertTitle>
            <AlertDescription>{hint}</AlertDescription>
          </Alert>
        ))}
        {revealed && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Answer</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {answer}
            </p>
          </div>
        )}
        {confidence !== null && (
          <Progress value={confidence}>
            <ProgressLabel>Self-rated confidence</ProgressLabel>
            <ProgressValue />
          </Progress>
        )}
        {revealed && nextRep && (
          <p className="text-sm text-muted-foreground">Next rep: {nextRep}</p>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-end gap-3">
        {!revealed && hasMoreHints && (
          <Button variant="outline" size="sm" onClick={showHint}>
            <Lightbulb className="size-4" />
            Hint
          </Button>
        )}
        {!revealed && (
          <Button size="sm" onClick={() => setRevealed(true)}>
            <Eye className="size-4" />
            Reveal
          </Button>
        )}
        {revealed && confidence === null && (
          <>
            <Button variant="outline" size="sm" onClick={() => setConfidence(25)}>
              Needed hint
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfidence(65)}>
              Shaky
            </Button>
            <Button size="sm" onClick={() => setConfidence(90)}>
              Solid
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
