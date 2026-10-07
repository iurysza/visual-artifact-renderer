"use client"

// Local, unpersisted plan state: decision answers plus spec-derived claim numbering.
// Never reads or writes annotation context (decisions D5, ruling 08:57).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import type { VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import {
  collectDecisions,
  indexClaims,
  needsOpenSet,
  suggestedAnswers,
  type ClaimInfo,
  type DecisionAnswers,
  type DecisionInfo,
} from "@/lib/plan/plan-spec"

type PlanContextValue = {
  title: string
  claims: Map<string, ClaimInfo>
  decisions: DecisionInfo[]
  needsOpen: Set<string>
  answers: DecisionAnswers
  setAnswer: (askId: string, optionIds: string[], other?: string) => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

export function DecisionAnswersProvider({ spec, children }: { spec: Pick<VisualArtifactSpec, "nodes" | "title">; children: ReactNode }) {
  const derived = useMemo(() => {
    const claims = indexClaims(spec)
    const decisions = collectDecisions(spec, claims)
    return { claims, decisions, needsOpen: needsOpenSet(spec, claims) }
  }, [spec])
  const [answers, setAnswers] = useState<DecisionAnswers>(() => suggestedAnswers(derived.decisions))
  const setAnswer = useCallback((askId: string, optionIds: string[], other?: string) => {
    setAnswers((previous) => ({ ...previous, [askId]: { optionIds, other, source: "reader" } }))
  }, [])
  const value = useMemo(
    () => ({ title: spec.title, ...derived, answers, setAnswer }),
    [spec.title, derived, answers, setAnswer],
  )
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlanContext(): PlanContextValue | null {
  return useContext(PlanContext)
}
