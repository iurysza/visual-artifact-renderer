#!/usr/bin/env tsx
import { execSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"

interface PipelineStep {
  id: string
  script: string
  description: string
  outputFiles: string[]
}

const STEPS: PipelineStep[] = [
  {
    id: "deterministic-extraction",
    script: "scripts/extract/index.ts",
    description: "Run deterministic probes (dependency-cruiser, knip, ast-grep, jscpd)",
    outputFiles: ["extractor-digest.md", "extractor-run.json", "packets/*.json", "reports/*.md"],
  },
  {
    id: "agentic-workflows",
    script: "scripts/extract/run-agentic-workflows.ts",
    description: "Launch agentic scouts for focused reports (codebase-orientation, hotspot-audit, etc.)",
    outputFiles: ["reports/codebase-orientation.md", "reports/important-components.md", "reports/hotspot-audit.md", "reports/change-scenario-trace.md", "reports/boundary-audit.md", "reports/testability-audit.md"],
  },
  {
    id: "report-director",
    script: "scripts/extract/run-report-director.ts",
    description: "Report Director decides thesis, audience, section order, and emphasis",
    outputFiles: ["report-direction.json", "report-direction.md"],
  },
  {
    id: "visualization-strategy",
    script: "scripts/extract/run-visualization-strategy.ts",
    description: "Visualization Art Director decides how to present the information",
    outputFiles: ["visualization-strategy.md"],
  },
  {
    id: "final-assembler",
    script: "scripts/extract/run-final-assembler.ts",
    description: "Final Assembler writes the validated VisualArtifactSpec JSON",
    outputFiles: ["visual-artifact-spec.json"],
  },
]

function runStep(repoRoot: string, slug: string, step: PipelineStep): void {
  const scriptPath = path.join(repoRoot, step.script)
  console.log(`\n${"=".repeat(60)}`)
  console.log(`STEP: ${step.id}`)
  console.log(`DESC: ${step.description}`)
  console.log(`=".repeat(60)}`)

  try {
    execSync(`npx tsx ${scriptPath} ${repoRoot} ${slug}`, {
      cwd: repoRoot,
      stdio: "inherit",
      timeout: 30 * 60 * 1000,
    })
    console.log(`✓ Step complete: ${step.id}`)
  } catch (error) {
    console.error(`✗ Step failed: ${step.id}`)
    throw error
  }
}

async function main() {
  const repoRoot = path.resolve(process.argv[2] ?? process.cwd())
  const slug = process.argv[3] ?? path.basename(repoRoot)
  const outputDir = path.join(repoRoot, "ai-artifacts", "generated", slug)

  console.log(`Visual Artifact Pipeline`)
  console.log(`Repository: ${repoRoot}`)
  console.log(`Slug: ${slug}`)
  console.log(`Output: ${outputDir}`)
  console.log(`Steps: ${STEPS.length}`)

  for (const step of STEPS) {
    runStep(repoRoot, slug, step)
  }

  console.log(`\n${"=".repeat(60)}`)
  console.log("PIPELINE COMPLETE")
  console.log(`=".repeat(60)}`)
  console.log(`\nGenerated files in ${outputDir}:`)
  for (const step of STEPS) {
    for (const file of step.outputFiles) {
      console.log(`  - ${file}`)
    }
  }

  const specPath = path.join(outputDir, "visual-artifact-spec.json")
  console.log(`\nNext step: Read ${specPath} and call create_visual_artifact with the JSON payload.`)
  console.log(`If validation fails, fix the JSON and retry until the tool succeeds.`)

  console.log(JSON.stringify({
    slug,
    outputDir,
    status: "complete",
    visualArtifactSpecPath: specPath,
    steps: STEPS.map((s) => ({ id: s.id, outputFiles: s.outputFiles })),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
