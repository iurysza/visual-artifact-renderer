#!/usr/bin/env bun
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { portArtifactSpec, specUsesRemovedNodes } from "../src/lib/port-contract-3.ts"

interface Options {
  from: string
  to?: string
  dryRun: boolean
  help: boolean
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { from: "", dryRun: false, help: false }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") opts.help = true
    else if (arg === "--dry-run") opts.dryRun = true
    else if (arg === "--from") opts.from = argv[++index] ?? ""
    else if (arg.startsWith("--from=")) opts.from = arg.slice("--from=".length)
    else if (arg === "--to") opts.to = argv[++index]
    else if (arg.startsWith("--to=")) opts.to = arg.slice("--to=".length)
    else throw new Error(`Unknown option: ${arg}`)
  }
  if (!opts.help && !opts.from) throw new Error("--from is required")
  return opts
}

function printHelp(): void {
  console.log(`Usage: bun run scripts/port-contract-3.ts --from <dir> [--to <artifacts-dir>] [--dry-run]

Reads artifact specs and rewrites removed contract nodes onto contract 3.

Accepted inputs:
  <project>/<slug>/artifact.json
  <project>/<slug>.json
  <project>__<slug>.json

--to writes bundles to <artifacts-dir>/<project>/<slug>/artifact.json.
Omit --to to print a summary without writing. --dry-run does the same.
`)
}

interface Found {
  project: string
  slug: string
  path: string
}

async function findSpecs(root: string): Promise<Found[]> {
  const found: Found[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      const nested = await readdir(path, { withFileTypes: true })
      for (const child of nested) {
        const childPath = join(path, child.name)
        if (child.isDirectory()) {
          found.push({ project: entry.name, slug: child.name, path: join(childPath, "artifact.json") })
        } else if (child.name.endsWith(".json") && child.name !== "artifact.json") {
          found.push({ project: entry.name, slug: child.name.slice(0, -".json".length), path: childPath })
        }
      }
    } else if (entry.name.endsWith(".json") && entry.name.includes("__")) {
      const [project, slugFile] = entry.name.split("__")
      found.push({ project, slug: slugFile.slice(0, -".json".length), path })
    }
  }
  return found.filter((item) => item.project && item.slug)
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }
  const from = resolve(opts.from)
  const specs = await findSpecs(from)
  const totals = new Map<string, number>()
  let written = 0
  let skipped = 0
  const warnings: string[] = []

  for (const spec of specs) {
    let raw: string
    try {
      raw = await readFile(spec.path, "utf8")
    } catch {
      skipped++
      warnings.push(`${spec.project}/${spec.slug}: missing ${spec.path}`)
      continue
    }
    const parsed = JSON.parse(raw) as unknown
    if (!specUsesRemovedNodes(parsed)) {
      skipped++
      continue
    }
    const { spec: ported, report } = portArtifactSpec(parsed)
    for (const [type, count] of Object.entries(report.replacements)) {
      totals.set(type, (totals.get(type) ?? 0) + count)
    }
    for (const warning of report.warnings) warnings.push(`${spec.project}/${spec.slug}: ${warning}`)
    if (!opts.to || opts.dryRun) {
      written++
      continue
    }
    const destination = join(resolve(opts.to), spec.project, spec.slug, "artifact.json")
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, `${JSON.stringify(ported, null, 2)}\n`, "utf8")
    written++
  }

  console.log(`${opts.to && !opts.dryRun ? "Wrote" : "Would write"} ${written} contract 3 spec${written === 1 ? "" : "s"}.`)
  console.log(`Skipped ${skipped} spec${skipped === 1 ? "" : "s"} with no removed nodes or no file.`)
  if (totals.size) {
    console.log("Replacements:")
    for (const [type, count] of [...totals.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`- ${type}: ${count}`)
    }
  }
  if (warnings.length) {
    console.log("Warnings:")
    for (const warning of warnings) console.log(`- ${warning}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
