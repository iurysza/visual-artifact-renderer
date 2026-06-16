export interface PipelineStep {
  id: string
  order: number
  script: string
  description: string
  outputs: string[]
  prompt?: string
  model?: string
  cli?: string
}

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "deterministic-extraction",
    order: 1,
    script: "pipeline/01-deterministic-extraction/step.ts",
    description: "Run deterministic probes (repo profile, folder layers, internal imports, package deps)",
    outputs: ["extractor-digest.md", "extractor-run.json", "packets/*.json", "reports/*.md"],
  },
  {
    id: "agentic-workflows",
    order: 2,
    script: "pipeline/02-agentic-workflows/step.ts",
    description: "Launch agentic scouts for focused reports (codebase-orientation, hotspot-audit, etc.)",
    outputs: ["reports/codebase-orientation.md", "reports/important-components.md", "reports/hotspot-audit.md", "reports/change-scenario-trace.md", "reports/boundary-audit.md", "reports/testability-audit.md"],
    prompt: "pipeline/02-agentic-workflows/prompt.md",
    model: "kimi/kimi-coding",
  },
  {
    id: "report-director",
    order: 3,
    script: "pipeline/03-report-director/step.ts",
    description: "Report Director decides thesis, audience, section order, and emphasis",
    outputs: ["report-direction.json", "report-direction.md"],
    prompt: "pipeline/03-report-director/prompt.md",
    model: "kimi/kimi-coding",
  },
  {
    id: "visualization-strategy",
    order: 4,
    script: "pipeline/04-visualization-strategy/step.ts",
    description: "Visualization Art Director decides how to present the information",
    outputs: ["visualization-strategy.md"],
    prompt: "pipeline/04-visualization-strategy/prompt.md",
    model: "kimi/kimi-coding",
  },
  {
    id: "final-assembler",
    order: 5,
    script: "pipeline/05-final-assembler/step.ts",
    description: "Final Assembler writes the validated VisualArtifactSpec JSON",
    outputs: ["visual-artifact-spec.json"],
    prompt: "pipeline/05-final-assembler/prompt.md",
    model: "kimi/kimi-coding",
  },
]

export function getStepById(id: string): PipelineStep | undefined {
  return PIPELINE_STEPS.find((step) => step.id === id)
}

export function getOrderedSteps(): PipelineStep[] {
  return [...PIPELINE_STEPS].sort((a, b) => a.order - b.order)
}
