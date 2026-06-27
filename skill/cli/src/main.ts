#!/usr/bin/env bun
import { program } from "commander"
import { Logger } from "./logger.ts"
import type { GlobalOpts } from "./types.ts"
import { create } from "./commands/create.ts"
import { validate } from "./commands/validate.ts"
import { serve } from "./commands/serve.ts"
import { serveStatus } from "./commands/serve-status.ts"
import { serveStop } from "./commands/serve-stop.ts"
import { list } from "./commands/list.ts"
import { openArtifact } from "./commands/open.ts"
import { doctor } from "./commands/doctor.ts"
import { bootstrap } from "./commands/bootstrap.ts"

const VERSION = "1.0.0"

function buildLogger(opts: GlobalOpts): Logger {
  return new Logger(opts)
}

program
  .name("visual-artifact")
  .description("Create, validate, and serve visual artifacts.")
  .version(VERSION, "--version")
  .configureOutput({ writeErr: (str) => process.stderr.write(str) })
  .helpOption("-h, --help", "Show help")
  .option("--json", "Output machine-readable JSON")
  .option("--plain", "Output stable line-based text")
  .option("-q, --quiet", "Suppress non-essential output")
  .option("-v, --verbose", "Show more detail")
  .option("--no-color", "Disable colored output")
  .option("--no-input", "Never prompt for input")

program
  .command("create [spec]")
  .description("Validate and save an artifact spec. Reads from file or stdin. Starts the renderer if it is not running.")
  .option("-p, --project <path>", "Project directory (default: current directory)")
  .option("-c, --contract <path>", "Path to artifact-contract.json")
  .option("--dry-run", "Validate only; do not write the artifact")
  .option("--no-serve", "Do not auto-start the renderer")
  .action(async (spec, opts) => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await create(spec, { ...globalOpts, ...opts }, log)
    process.exit(exitCode)
  })

program
  .command("validate [spec]")
  .description("Validate an artifact spec without writing it.")
  .option("-c, --contract <path>", "Path to artifact-contract.json")
  .action(async (spec, opts) => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await validate(spec, { ...globalOpts, ...opts }, log)
    process.exit(exitCode)
  })

const serveCmd = program
  .command("serve")
  .description("Start the artifact renderer server.")
  .option("--port <number>", "Server port", parseInt)
  .option("--host <address>", "Server host")
  .option("--out-dir <path>", "Static export directory")
  .option("--artifacts-dir <path>", "Artifacts directory")
  .option("--mount-path <path>", "URL mount path")
  .option("--data-path <path>", "Data API path")
  .option("--open", "Open browser on start")
  .option("--no-open", "Do not open browser")
  .action(async (opts) => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await serve(opts, log)
    process.exit(exitCode)
  })

serveCmd
  .command("status")
  .description("Check whether the renderer server is running.")
  .action(async () => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await serveStatus(log)
    process.exit(exitCode)
  })

serveCmd
  .command("stop")
  .description("Stop the renderer server if it is tracked.")
  .action(async () => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await serveStop(log)
    process.exit(exitCode)
  })

program
  .command("list [project]")
  .description("List projects or artifacts in a project.")
  .action(async (project) => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await list(project, log)
    process.exit(exitCode)
  })

program
  .command("open [target]")
  .description("Open an artifact in the browser. Target is <project>/<slug>.")
  .action(async (target) => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await openArtifact(target, log)
    process.exit(exitCode)
  })

program
  .command("bootstrap")
  .description("Build the renderer, compile the CLI, and install the binary.")
  .option("--dry-run", "Show what would be done without making changes")
  .action(async (opts) => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await bootstrap({ dryRun: opts.dryRun ?? false }, log)
    process.exit(exitCode)
  })

program
  .command("doctor")
  .description("Run health checks for the visual-artifact setup.")
  .action(async () => {
    const globalOpts = program.opts() as GlobalOpts
    const log = buildLogger(globalOpts)
    const exitCode = await doctor(log)
    process.exit(exitCode)
  })

async function main(): Promise<void> {
  await program.parseAsync(process.argv)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
