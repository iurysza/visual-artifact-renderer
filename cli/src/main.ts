#!/usr/bin/env bun
import { InvalidArgumentError, Option, program } from "commander"
import { ConfigValidationError } from "./config.ts"
import { loadEnvFile } from "./env.ts"
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
import { contract } from "./commands/contract.ts"
import { setupCloudflare } from "./commands/setup-cloudflare.ts"
import { VERSION } from "./version.ts"

function parsePort(value: string): number {
  const num = Number(value)
  if (!/^\d+$/.test(value) || !Number.isInteger(num) || num < 1 || num > 65535) {
    throw new InvalidArgumentError(`port must be an integer between 1 and 65535; got ${value}`)
  }
  return num
}

function buildLogger(): Logger {
  return new Logger(globalOptsFromProgram())
}

const OptionJson = new Option("--json", "Output machine-readable JSON").conflicts("plain")
const OptionPlain = new Option("--plain", "Output stable line-based text").conflicts("json")

program
  .name("visual-artifact")
  .description("Create, validate, and serve visual artifacts.")
  .version(VERSION, "--version")
  .configureOutput({
    writeErr: (str) => process.stderr.write(str),
    writeOut: (str) => process.stdout.write(str),
    outputError: (str, write) => write(str),
  })
  .helpOption("-h, --help", "Show help")
  .addOption(OptionJson)
  .addOption(OptionPlain)
  .option("-q, --quiet", "Suppress non-essential output")
  .option("-v, --verbose", "Show more detail")
  .option("--no-color", "Disable colored output")
  .option("--no-input", "Never prompt for input")
  .option("--allow-remote", "Allow remote connections to the writable serve API")
  .exitOverride()

let exitCode = 0

async function runAction(name: string, action: (log: Logger) => Promise<number>): Promise<void> {
  const log = buildLogger()
  const start = performance.now()
  try {
    log.debug(`starting ${name}`)
    exitCode = await action(log)
    log.debug(`finished ${name} in ${(performance.now() - start).toFixed(1)}ms`)
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      exitCode = 2
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    log.error(message, error)
    exitCode = 1
  }
}

const setupCmd = program
  .command("setup")
  .description("Configure visual artifact integrations.")

setupCmd
  .command("cloudflare")
  .description("Configure BYO Cloudflare publishing.")
  .option("--account-id <id>", "Cloudflare account ID (or CLOUDFLARE_ACCOUNT_ID)")
  .option("--bucket <name>", "R2 bucket name (or VISUAL_ARTIFACT_CLOUDFLARE_R2_BUCKET)")
  .option("--worker-name <name>", "Worker name")
  .option("--base-url <url>", "Public base URL, usually https://<worker>.<subdomain>.workers.dev")
  .option("--workers-dev-subdomain <name>", "Cloudflare workers.dev subdomain used to derive the base URL")
  .option("--cloud-route-strategy <zero-pages|placeholder>", "Cloud build dynamic route export strategy")
  .option("--profile <name>", "Publish profile name", "default")
  .option("--non-interactive", "Fail instead of prompting for missing values")
  .option("--dry-run", "Validate setup without writing the profile")
  .action(async (opts) => {
    await runAction("setup cloudflare", (log) => setupCloudflare({ ...globalOptsFromProgram(), ...opts }, log))
  })

const allowReadOption = new Option(
  "--allow-read <dir>",
  "Authorize reading file-tree sources under this directory (repeatable)",
).argParser((value: string, previous: string[] = []) => [...previous, value])

program
  .command("create [spec]")
  .description("Validate and save an artifact spec. Reads from file or stdin. Starts the renderer if it is not running.")
  .option("-p, --project <path>", "Project directory (default: current directory)")
  .option("--dry-run", "Validate only; do not write the artifact")
  .option("--no-serve", "Do not auto-start the renderer")
  .option("--publish [profile]", "Publish the artifact to Cloudflare using the named profile")
  .addOption(allowReadOption)
  .action(async (spec, opts) => {
    await runAction("create", (log) => create(spec, { ...globalOptsFromProgram(), ...opts }, log))
  })

program
  .command("validate [spec]")
  .description("Validate an artifact spec without writing it.")
  .action(async (spec) => {
    await runAction("validate", (log) => validate(spec, globalOptsFromProgram(), log))
  })

const serveCmd = program
  .command("serve")
  .description("Start the artifact renderer server.")
  .configureHelp({ showGlobalOptions: true })
  .option("--port <number>", "Server port", parsePort)
  .option("--host <address>", "Server host")
  .option("--out-dir <path>", "Static export directory")
  .option("--artifacts-dir <path>", "Artifacts directory")
  .option("--data-path <path>", "Data API path")
  .option("--open", "Open browser on start")
  .option("--no-open", "Do not open browser")
  .action(async (opts) => {
    const globalOpts = globalOptsFromProgram()
    await runAction("serve", (log) => serve({ ...opts, allowRemote: globalOpts.allowRemote }, log))
  })

serveCmd
  .command("status")
  .description("Check whether the renderer server is running.")
  .option("--port <number>", "Server port", parsePort)
  .option("--host <address>", "Server host")
  .action(async (_opts, command) => {
    const opts = command.optsWithGlobals()
    await runAction("serve status", (log) => serveStatus(log, {
      port: opts.port,
      host: opts.host,
    }))
  })

serveCmd
  .command("stop")
  .description("Stop the renderer server if it is tracked.")
  .option("--port <number>", "Server port", parsePort)
  .option("--host <address>", "Server host")
  .option("--force", "Terminate an ambiguous listener on the target port")
  .action(async (_opts, command) => {
    const opts = command.optsWithGlobals()
    await runAction("serve stop", (log) => serveStop({
      port: opts.port,
      host: opts.host,
      force: opts.force,
    }, log))
  })

program
  .command("list [project]")
  .description("List projects or artifacts in a project.")
  .action(async (project) => {
    await runAction("list", (log) => list(project, log))
  })

program
  .command("open [target]")
  .description("Open an artifact in the browser. Target is <project>/<slug>.")
  .action(async (target) => {
    await runAction("open", (log) => openArtifact(target, log))
  })

program
  .command("bootstrap")
  .description("Build the renderer, compile the CLI, and install the binary.")
  .option("--dry-run", "Show what would be done without making changes")
  .action(async (opts) => {
    await runAction("bootstrap", (log) => bootstrap({ dryRun: opts.dryRun ?? false }, log))
  })

program
  .command("contract")
  .description("Print the artifact contract used for validation.")
  .option("-c, --contract <path>", "Path to artifact-contract.json")
  .option("-f, --format <json|summary>", "Output format")
  .option("-n, --node <type>", "Print the definition for a single node type")
  .action(async (opts) => {
    await runAction("contract", (log) => contract({ ...globalOptsFromProgram(), ...opts }, log))
  })

program
  .command("doctor")
  .description("Run health checks for the visual-artifact setup.")
  .action(async () => {
    await runAction("doctor", (log) => doctor(log))
  })

function globalOptsFromProgram(): GlobalOpts {
  const opts = program.opts() as {
    json?: boolean
    plain?: boolean
    quiet?: boolean
    verbose?: boolean
    color?: boolean
    input?: boolean
    allowRemote?: boolean
  }
  return {
    json: opts.json ?? false,
    plain: opts.plain ?? false,
    quiet: opts.quiet ?? false,
    verbose: opts.verbose ?? false,
    noColor: opts.color === false,
    noInput: opts.input === false,
    allowRemote: opts.allowRemote === true ? true : undefined,
  }
}

async function main(): Promise<void> {
  await loadEnvFile()

  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code: string }).code
      if (code === "commander.helpDisplayed" || code === "commander.help" || code === "commander.version") {
        process.exit(0)
      }
      // Commander already wrote the error via configureOutput.outputError.
      process.exit(2)
    }
    throw error
  }

  process.exit(exitCode)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
