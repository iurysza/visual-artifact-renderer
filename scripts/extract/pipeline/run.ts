#!/usr/bin/env tsx
import { execSync } from "node:child_process"
import path from "node:path"
import { getOrderedSteps, getStepById, type PipelineStep } from "./steps"

interface RunOptions {
  repoRoot: string
  slug: string
  from?: string
  only?: string
}

function parseArgs(): RunOptions {
  const args = process.argv.slice(2)
  const repoRoot = path.resolve(args[0] ?? process.cwd())
  const slug = args[1] ?? path.basename(repoRoot)
  let from: string | undefined
  let only: string | undefined

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      from = args[i + 1]
      i++
    } else if (args[i] === "--only" && args[i + 1]) {
      only = args[i + 1]
      i++
    }
  }

  return { repoRoot, slug, from, only }
}

function resolveScriptPath(repoRoot: string, script: string): string {
  return path.join(repoRoot, "scripts/extract", script)
}

function runStep(repoRoot: string, slug: string, step: PipelineStep): void {
  const scriptPath = resolveScriptPath(repoRoot, step.script)
  console.log(`\n${"=".repeat(60)}`)
  console.log(`STEP: ${step.order}. ${step.id}`)
  console.log(`DESC: ${step.description}`)
  console.log(`${"=".repeat(60)}`)

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

function getStepsToRun(options: RunOptions): PipelineStep[] {
  const ordered = getOrderedSteps()

  if (options.only) {
    const step = getStepById(options.only)
    if (!step) {
      throw new Error(`Unknown step: ${options.only}. Available: ${ordered.map((s) => s.id).join(", ")}`)
    }
    return [step]
  }

  if (options.from) {
    const fromIndex = ordered.findIndex((step) => step.id === options.from)
    if (fromIndex === -1) {
      throw new Error(`Unknown step: ${options.from}. Available: ${ordered.map((s) => s.id).join(", ")}`)
    }
    return ordered.slice(fromIndex)
  }

  return ordered
}

async function main() {
  const options = parseArgs()
  const outputDir = path.join(options.repoRoot, "ai-artifacts", "generated", options.slug)
  const steps = getStepsToRun(options)

  console.log(`Visual Artifact Pipeline`)
  console.log(`Repository: ${options.repoRoot}`)
  console.log(`Slug: ${options.slug}`)
  console.log(`Output: ${outputDir}`)
  console.log(`Steps: ${steps.map((s) => s.id).join(" → ")}`)

  for (const step of steps) {
    runStep(options.repoRoot, options.slug, step)
  }

  const allSteps = getOrderedSteps()
  console.log(`\n${"=".repeat(60)}`)
  console.log("PIPELINE COMPLETE")
  console.log(`${"=".repeat(60)}`)
  console.log(`\nGenerated files in ${outputDir}:`)
  for (const step of allSteps) {
    for (const file of step.outputs) {
      console.log(`  - ${file}`)
    }
  }

  const specPath = path.join(outputDir, "visual-artifact-spec.json")
  console.log(`\nNext step: Read ${specPath} and call create_visual_artifact with the JSON payload.`)
  console.log(`If validation fails, fix the JSON and retry until the tool succeeds.`)

  console.log(JSON.stringify({
    slug: options.slug,
    outputDir,
    status: "complete",
    visualArtifactSpecPath: specPath,
    steps: allSteps.map((s) => ({ id: s.id, order: s.order, outputFiles: s.outputs })),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
