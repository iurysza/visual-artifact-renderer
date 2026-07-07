#!/usr/bin/env bun
import { resolve } from "node:path"
import { loadConfig } from "../src/config.ts"
import { migrateFlatArtifacts } from "../src/lib/migrate-artifacts.ts"

interface CliOptions {
  apply: boolean
  artifactsDir?: string
  backupDir?: string
  json: boolean
  help: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { apply: false, json: false, help: false }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--apply") {
      opts.apply = true
    } else if (arg === "--json") {
      opts.json = true
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true
    } else if (arg === "--artifacts-dir") {
      const value = argv[++i]
      if (!value) throw new Error("--artifacts-dir requires a path")
      opts.artifactsDir = value
    } else if (arg.startsWith("--artifacts-dir=")) {
      opts.artifactsDir = arg.slice("--artifacts-dir=".length)
    } else if (arg === "--backup-dir") {
      const value = argv[++i]
      if (!value) throw new Error("--backup-dir requires a path")
      opts.backupDir = value
    } else if (arg.startsWith("--backup-dir=")) {
      opts.backupDir = arg.slice("--backup-dir=".length)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return opts
}

function printHelp(): void {
  console.log(`Usage: bun run scripts/migrate-artifacts.ts [options]

Migrates old flat artifacts:
  <artifacts>/<project>/<slug>.json

into bundle artifacts:
  <artifacts>/<project>/<slug>/artifact.json
  <artifacts>/<project>/<slug>/annotations.json
  <artifacts>/<project>/<slug>/assets/

Options:
  --apply                 Write changes. Omit for dry run.
  --artifacts-dir <path>  Artifacts directory. Defaults to visual-artifact config.
  --backup-dir <path>     Backup directory. Defaults to <skill-root>/.migration-backup/<timestamp>.
  --json                  Print machine-readable summary.
  -h, --help              Show help.
`)
}

function printHuman(summary: Awaited<ReturnType<typeof migrateFlatArtifacts>>): void {
  const action = summary.apply ? "Migrated" : "Would migrate"
  const count = summary.apply ? summary.migrated : summary.wouldMigrate

  console.log(`${action} ${count} flat artifact${count === 1 ? "" : "s"}.`)
  console.log(`Artifacts: ${summary.artifactsDir}`)
  console.log(`Backup:    ${summary.backupDir}`)

  for (const result of summary.results) {
    const label = result.status === "skipped" ? "skip" : result.status === "migrated" ? "migrate" : "would"
    const reason = result.reason ? ` (${result.reason})` : ""
    console.log(`- ${label}: ${result.project}/${result.slug}${reason}`)
  }

  if (!summary.apply && summary.wouldMigrate > 0) {
    console.log("\nDry run only. Re-run with --apply to move files.")
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }

  const config = loadConfig()
  const artifactsDir = resolve(opts.artifactsDir ?? config.artifactsDir)
  const backupDir = opts.backupDir ? resolve(opts.backupDir) : undefined
  const summary = await migrateFlatArtifacts({ artifactsDir, backupDir, apply: opts.apply })

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    printHuman(summary)
  }

  if (summary.skipped > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
