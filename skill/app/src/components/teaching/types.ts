export interface SourceLink {
  label: string
  href: string
}

export interface MissionModel {
  why: string
  successLooksLike: string[]
  constraints: string[]
  outOfScope: string[]
}

export interface QuizOption {
  value: string
  label: string
}

export interface LearningRecord {
  number: number
  slug: string
  title: string
  summary: string
  evidence?: string
  misconceptionCorrected?: string
  implication?: string
  status?: "active" | `superseded by LR-${string}`
}

export interface ReferenceDoc {
  title: string
  href?: string
  description: string
}

export interface DueRep {
  concept: string
  due: string
  strength: "weak" | "medium" | "fresh"
  task: string
}
