import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_ROOT = resolve(__dirname, "..")
const CLI_MAIN = join(CLI_ROOT, "src", "main.ts")
const CLI_BIN = join(CLI_ROOT, "dist", "visual-artifact")
const CLI_DIR = CLI_ROOT

const REPO_ARTIFACTS_DIR = resolve(__dirname, "..", "..", "artifacts")

interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

type Target = "source" | "binary"

function runCli(target: Target, args: string[], env: Record<string, string> = {}, input?: string): RunResult {
  const cmd = target === "binary" ? CLI_BIN : process.execPath
  const cmdArgs = target === "binary" ? args : [CLI_MAIN, ...args]
  const baseEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("VISUAL_ARTIFACT_")) continue
    if (key === "XDG_STATE_HOME" || key === "XDG_CONFIG_HOME" || key === "XDG_DATA_HOME") continue
    if (value !== undefined) baseEnv[key] = value
  }
  const proc = spawnSync(cmd, cmdArgs, {
    cwd: CLI_DIR,
    env: { ...baseEnv, ...env },
    input: input ?? "",
    encoding: "utf8",
    timeout: 30000,
  })
  return {
    exitCode: proc.status ?? 1,
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? "",
  }
}

const validSpec = JSON.stringify({
  slug: "test",
  title: "Test",
  nodes: [
    { type: "text", props: { text: "hi" } },
    { type: "section", children: [{ type: "text", props: { text: "nested" } }] },
  ],
})

const specWithData = JSON.stringify({
  slug: "data-test",
  title: "Data Test",
  data: { sales: [{ month: "Jan", value: 100 }] },
  nodes: [{ type: "area-chart", props: { dataKey: "sales", xKey: "month", yKey: "value" } }],
})

async function prepareTemp(): Promise<{ dir: string; artifactsDir: string; outDir: string; stateDir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "va-int-"))
  const artifactsDir = join(dir, "artifacts")
  const outDir = join(dir, "out")
  const stateDir = join(dir, "state")
  await writeFile(join(dir, ".git"), "", "utf8") // prevent deriveProjectName using repo git root
  return { dir, artifactsDir, outDir, stateDir }
}

function baseEnv(artifactsDir: string, outDir: string, stateDir: string): Record<string, string> {
  return {
    VISUAL_ARTIFACT_ARTIFACTS_DIR: artifactsDir,
    VISUAL_ARTIFACT_OUT_DIR: outDir,
    XDG_STATE_HOME: stateDir,
  }
}

async function repoArtifactCount(): Promise<number> {
  if (!existsSync(REPO_ARTIFACTS_DIR)) return 0
  const proc = spawnSync("find", [REPO_ARTIFACTS_DIR, "-type", "f", "-name", "*.json"], { encoding: "utf8" })
  return (proc.stdout ?? "").split("\n").filter((l) => l && !l.endsWith("/annotations.json") && !l.endsWith("/publish.json")).length
}

describe.each(["source", "binary"] as Target[])("CLI integration (%s)", (target) => {
  let dir: string
  let artifactsDir: string
  let outDir: string
  let stateDir: string
  let initialRepoCount: number

  beforeAll(async () => {
    if (target === "binary") {
      const build = spawnSync(process.execPath, ["run", "scripts/build.ts"], {
        cwd: CLI_DIR,
        env: process.env,
        encoding: "utf8",
        timeout: 120000,
      })
      expect(build.status).toBe(0)
      expect(existsSync(CLI_BIN)).toBe(true)
    }
    initialRepoCount = await repoArtifactCount()
  })

  beforeEach(async () => {
    ;({ dir, artifactsDir, outDir, stateDir } = await prepareTemp())
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  afterAll(async () => {
    const finalRepoCount = await repoArtifactCount()
    expect(finalRepoCount).toBe(initialRepoCount)
  })

  test("help exits 0 with stdout only", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--help"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("Usage:")
    expect(stderr).toBe("")
  })

  test("serve help documents remote exposure opt-in", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["serve", "--help"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("--allow-remote")
    expect(stdout).toContain("writable serve API")
    expect(stderr).toBe("")
  })

  test("version exits 0 with stdout only", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--version"])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
    expect(stderr).toBe("")
  })

  test("json+plain conflict exits 2 with empty stdout", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--json", "--plain", "validate", "-"], {}, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("cannot be used")
  })

  test("unknown option exits 2 with empty stdout", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--unknown-option"])
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("unknown option")
  })

  test("unknown command exits 2 with empty stdout", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["not-a-command"])
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("unknown command")
  })

  test("invalid port exits 2 before side effects", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_PORT: "nope" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("port")
  })

  test("float and scientific-notation ports exit 2", () => {
    for (const value of ["1.5", "1e3"]) {
      const { exitCode, stdout } = runCli(
        target,
        ["validate", "-"],
        { VISUAL_ARTIFACT_PORT: value },
        validSpec,
      )
      expect(exitCode).toBe(2)
      expect(stdout).toBe("")
    }
  })

  test("port 0 exits 2", () => {
    const { exitCode, stdout } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_PORT: "0" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
  })

  test("port 65536 exits 2", () => {
    const { exitCode, stdout } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_PORT: "65536" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
  })

  test("invalid hostname exits 2", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_HOST: "bad::host" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("host")
  })

  test("hostname with scheme exits 2", () => {
    const { exitCode, stdout } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_HOST: "http://127.0.0.1" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
  })

  test("IPv4 loopback host accepted", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--plain", "validate", "-"], { VISUAL_ARTIFACT_HOST: "127.0.0.1" }, validSpec)
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^VALID\ttest\t3\t0$/)
    expect(stderr).toBe("")
  })

  test("IPv6 loopback host accepted", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--plain", "validate", "-"], { VISUAL_ARTIFACT_HOST: "::1" }, validSpec)
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^VALID\ttest\t3\t0$/)
    expect(stderr).toBe("")
  })

  test("bracketed IPv6 is normalized once in URLs", () => {
    const { exitCode, stdout } = runCli(
      target,
      ["--plain", "serve", "status", "--host", "[::1]", "--port", "49152"],
      baseEnv(artifactsDir, outDir, stateDir),
    )
    expect(exitCode).toBe(1)
    expect(stdout).toContain("http://[::1]:49152")
    expect(stdout).not.toContain("[[::1]]")
    expect(stdout).not.toContain("/artifacts")
  })

  test("invalid base URL exits 2", () => {
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["validate", "-"],
      { VISUAL_ARTIFACT_BASE_URL: "https://u:p@bad.com" },
      validSpec,
    )
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("credentials")
  })

  test("empty base URL exits 2", () => {
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["validate", "-"],
      { VISUAL_ARTIFACT_BASE_URL: "" },
      validSpec,
    )
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("base URL must not be empty")
  })

  test("base URL with query exits 2", () => {
    const { exitCode, stdout } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_BASE_URL: "https://example.com/?x=1" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
  })

  test("base URL with hash exits 2", () => {
    const { exitCode, stdout } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_BASE_URL: "https://example.com/#x" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
  })

  test("boolean env strict: true and whitespace are invalid", () => {
    for (const env of [
      { VISUAL_ARTIFACT_OPEN: "true" },
      { VISUAL_ARTIFACT_OPEN: " 1 " },
      { VISUAL_ARTIFACT_ALLOW_REMOTE: " 0 " },
    ] as Array<Record<string, string>>) {
      const { exitCode, stdout, stderr } = runCli(target, ["validate", "-"], env, validSpec)
      expect(exitCode).toBe(2)
      expect(stdout).toBe("")
      expect(stderr).toContain("must be 0 or 1")
    }
  })

  test("boolean env strict: 0 accepted", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--plain", "validate", "-"], { VISUAL_ARTIFACT_OPEN: "0" }, validSpec)
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^VALID\ttest\t3\t0$/)
    expect(stderr).toBe("")
  })

  test("empty artifacts dir env exits 2", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_ARTIFACTS_DIR: "" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("empty")
  })

  test("empty out dir env exits 2", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_OUT_DIR: "" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("empty")
  })

  test("invalid data path exits 2", () => {
    const { exitCode, stdout } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_DATA_PATH: "/data?x=1" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
  })

  test("allowRemote env strict: yes invalid", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["validate", "-"], { VISUAL_ARTIFACT_ALLOW_REMOTE: "yes" }, validSpec)
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("VISUAL_ARTIFACT_ALLOW_REMOTE must be 0 or 1")
  })

  test("non-loopback host rejected without --allow-remote", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["serve", "--host", "0.0.0.0"])
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("non-loopback")
  })

  test("--allow-remote overrides the default before bind", () => {
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["--allow-remote", "serve", "--host", "0.0.0.0", "--no-open"],
      baseEnv(artifactsDir, outDir, stateDir),
    )
    expect(exitCode).toBe(1)
    expect(stdout).toBe("")
    expect(stderr).not.toContain("non-loopback")
    expect(stderr).toContain("Static export directory missing")
  })

  test("quiet suppresses diagnostics but keeps every result mode", () => {
    const env = baseEnv(artifactsDir, outDir, stateDir)
    const plain = runCli(target, ["--quiet", "--plain", "validate", "-"], env, validSpec)
    expect(plain.exitCode).toBe(0)
    expect(plain.stdout.trim()).toBe("VALID\ttest\t3\t0")
    expect(plain.stderr).toBe("")

    const human = runCli(target, ["--quiet", "validate", "-"], env, validSpec)
    expect(human.exitCode).toBe(0)
    expect(human.stdout.trim()).toBe("Valid artifact: test")
    expect(human.stderr).toBe("")

    const json = runCli(target, ["--quiet", "--json", "create", "-", "--no-serve"], env, validSpec)
    expect(json.exitCode).toBe(0)
    expect(JSON.parse(json.stdout).command).toBe("create")
    expect(json.stderr).toBe("")
  }, 30_000)

  test("NO_COLOR disables ANSI", () => {
    const { exitCode, stderr } = runCli(target, ["validate", "-"], { NO_COLOR: "" }, '{"bad":1}')
    expect(exitCode).toBe(2)
    expect(stderr).not.toContain("\x1b[")
  })

  test("TERM=dumb and --no-color disable ANSI", () => {
    for (const [args, env] of [
      [["validate", "-"], { TERM: "DuMb" }],
      [["--no-color", "validate", "-"], {}],
    ] as const) {
      const { exitCode, stderr } = runCli(target, [...args], env, '{"bad":1}')
      expect(exitCode).toBe(2)
      expect(stderr).not.toContain("\x1b[")
    }
  })

  test("json output has envelope and primary fields", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--json", "validate", "-"], baseEnv(artifactsDir, outDir, stateDir), validSpec)
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    const parsed = JSON.parse(stdout)
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.command).toBe("validate")
    expect(parsed.ok).toBe(true)
    expect(parsed.totalNodes).toBe(3)
  })

  test("create json preserves Pi fields", () => {
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["--json", "create", "-", "--no-serve"],
      baseEnv(artifactsDir, outDir, stateDir),
      validSpec,
    )
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    const parsed = JSON.parse(stdout)
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.command).toBe("create")
    expect(typeof parsed.slug).toBe("string")
    expect(typeof parsed.projectName).toBe("string")
    expect(typeof parsed.projectPath).toBe("string")
    expect(typeof parsed.path).toBe("string")
    expect(typeof parsed.url).toBe("string")
    expect(typeof parsed.localUrl).toBe("string")
  })

  test("Pi argument ordering still produces one JSON document", () => {
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["create", "-", "--project", dir, "--json", "--no-serve"],
      baseEnv(artifactsDir, outDir, stateDir),
      validSpec,
    )
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    const parsed = JSON.parse(stdout)
    expect(parsed.command).toBe("create")
    expect(parsed.schemaVersion).toBe(1)
    expect(typeof parsed.bundleDir).toBe("string")
  })

  test("create honors project config precedence", async () => {
    const envProject = join(dir, "env-project")
    const cliProject = join(dir, "cli-project")
    await mkdir(envProject, { recursive: true })
    await mkdir(cliProject, { recursive: true })
    const env = {
      ...baseEnv(artifactsDir, outDir, stateDir),
      VISUAL_ARTIFACT_PROJECT_PATH: envProject,
    }

    const fromEnv = runCli(target, ["--json", "create", "-", "--no-serve"], env, validSpec)
    expect(fromEnv.exitCode).toBe(0)
    expect(JSON.parse(fromEnv.stdout).projectPath).toBe(envProject)

    const fromCli = runCli(
      target,
      ["--json", "create", "-", "--project", cliProject, "--no-serve"],
      env,
      validSpec,
    )
    expect(fromCli.exitCode).toBe(0)
    expect(JSON.parse(fromCli.stdout).projectPath).toBe(cliProject)
  })

  test("create plain emits URL", () => {
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["--plain", "create", "-", "--no-serve"],
      baseEnv(artifactsDir, outDir, stateDir),
      validSpec,
    )
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    expect(stdout.trim()).toMatch(/^http/)
  })

  test("open plain and JSON keep stable primary output", async () => {
    const fakeBin = join(dir, "bin")
    await mkdir(fakeBin, { recursive: true })
    for (const command of ["open", "xdg-open"]) {
      const commandPath = join(fakeBin, command)
      await writeFile(commandPath, "#!/bin/sh\nexit 0\n", "utf8")
      await chmod(commandPath, 0o755)
    }
    const env = {
      ...baseEnv(artifactsDir, outDir, stateDir),
      VISUAL_ARTIFACT_BASE_URL: "https://example.test",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    }

    const plain = runCli(target, ["--plain", "open", "demo/report"], env)
    expect(plain.exitCode).toBe(0)
    expect(plain.stdout.trim()).toBe("https://example.test/demo/report/")
    expect(plain.stderr).toBe("")

    const json = runCli(target, ["--json", "open", "demo/report"], env)
    expect(json.exitCode).toBe(0)
    expect(JSON.parse(json.stdout)).toMatchObject({
      schemaVersion: 1,
      command: "open",
      project: "demo",
      slug: "report",
      url: "https://example.test/demo/report/",
    })
    expect(json.stderr).toBe("")
  })

  test("create dry-run human output is readable", () => {
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["create", "-", "--dry-run", "--no-serve"],
      baseEnv(artifactsDir, outDir, stateDir),
      validSpec,
    )
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    expect(stdout).toContain("Spec is valid")
    expect(stdout).not.toContain("[object Object]")
  })

  test("create dry-run plain emits VALID record", () => {
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["--plain", "create", "-", "--dry-run", "--no-serve"],
      baseEnv(artifactsDir, outDir, stateDir),
      specWithData,
    )
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    expect(stdout.trim()).toMatch(/^VALID\tdata-test\t1\t1$/)
  })

  test("invalid config does not write artifact", async () => {
    const specPath = join(dir, "spec.json")
    await writeFile(specPath, validSpec, "utf8")
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["create", specPath, "--no-serve"],
      { ...baseEnv(artifactsDir, outDir, stateDir), VISUAL_ARTIFACT_ARTIFACTS_DIR: "" },
    )
    expect(exitCode).toBe(2)
    expect(stdout).toBe("")
    expect(stderr).toContain("empty")
    expect(existsSync(artifactsDir)).toBe(false)
    expect(existsSync(stateDir)).toBe(false)
  })

  test("blank CLI path overrides exit 2 before side effects", () => {
    const env = baseEnv(artifactsDir, outDir, stateDir)
    // Bun 1.1 child_process drops zero-length argv entries, so subprocess
    // coverage uses whitespace; config.test.ts covers the exact empty string.
    for (const args of [
      ["create", "-", "--project", " ", "--dry-run", "--no-serve"],
      ["serve", "--out-dir", " ", "--no-open"],
      ["serve", "--artifacts-dir", " ", "--no-open"],
    ]) {
      const { exitCode, stdout, stderr } = runCli(target, args, env, validSpec)
      expect(exitCode).toBe(2)
      expect(stdout).toBe("")
      expect(stderr).toContain("must not be empty")
    }
    expect(existsSync(artifactsDir)).toBe(false)
    expect(existsSync(stateDir)).toBe(false)
  })

  test("verbose emits timing to stderr", () => {
    const { exitCode, stderr } = runCli(
      target,
      ["--verbose", "--plain", "validate", "-"],
      baseEnv(artifactsDir, outDir, stateDir),
      validSpec,
    )
    expect(exitCode).toBe(0)
    expect(stderr).toContain("ms")
  })

  test("verbose unexpected error includes stack and timing", () => {
    const missing = join(dir, "missing-contract.json")
    const { exitCode, stdout, stderr } = runCli(
      target,
      ["--verbose", "contract", "--contract", missing],
      baseEnv(artifactsDir, outDir, stateDir),
    )
    expect(exitCode).toBe(1)
    expect(stdout).toBe("")
    expect(stderr).toContain("missing-contract.json")
    expect(stderr).toContain("at ")
    expect(stderr).toContain("ms")
  })

  test("contract defaults to human summary", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["contract"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("Visualizer artifact contract")
    expect(stdout).toContain("Node types:")
    expect(stdout.trimStart().startsWith("{")).toBe(false)
    expect(stderr).toBe("")
  })

  test("contract JSON keeps the full contract", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--json", "contract"])
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    const parsed = JSON.parse(stdout)
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.command).toBe("contract")
    expect(parsed.spec).toBeDefined()
    expect(parsed.nodes).toBeDefined()
    expect(parsed.limits).toBeDefined()
  })

  test("explicit contract JSON and versioned summary JSON preserve both modes", () => {
    const legacy = runCli(target, ["contract", "--format", "json"])
    expect(legacy.exitCode).toBe(0)
    expect(JSON.parse(legacy.stdout).nodes).toBeDefined()
    expect(legacy.stderr).toBe("")

    const summary = runCli(target, ["--json", "contract", "--format", "summary"])
    expect(summary.exitCode).toBe(0)
    expect(JSON.parse(summary.stdout)).toMatchObject({
      schemaVersion: 1,
      command: "contract",
      nodeCount: expect.any(Number),
    })
    expect(JSON.parse(summary.stdout).nodes).toBeUndefined()
    expect(summary.stderr).toBe("")
  })

  test("plain contract emits deterministic records", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--plain", "contract"])
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    const lines = stdout.trim().split("\n")
    expect(lines[0]).toMatch(/^CONTRACT\t\d+\.\d+\.\d+$/)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines.slice(1)) {
      expect(line).toMatch(/^NODE\t/)
    }
  })

  async function writeArtifactFixture(): Promise<Record<string, string>> {
    const bundleDir = join(artifactsDir, "demo", "artifact-one")
    await mkdir(bundleDir, { recursive: true })
    await mkdir(outDir, { recursive: true })
    await writeFile(join(bundleDir, "artifact.json"), JSON.stringify({
      slug: "artifact-one",
      title: "Artifact One",
      nodes: [{ type: "text", props: { text: "one" } }],
    }))
    return baseEnv(artifactsDir, outDir, stateDir)
  }

  test("plain project list emits a stable record", async () => {
    const env = await writeArtifactFixture()
    const result = runCli(target, ["--plain", "list"], env)
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toMatch(/^PROJECT\tdemo\t1\t/)
  })

  test("plain artifact list emits a stable record", async () => {
    const env = await writeArtifactFixture()
    const result = runCli(target, ["--plain", "list", "demo"], env)
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("ARTIFACT\tdemo\tartifact-one\tArtifact One\t")
  })

  test("plain doctor emits stable records", () => {
    const result = runCli(target, ["--plain", "doctor"], baseEnv(artifactsDir, outDir, stateDir))
    expect([0, 1]).toContain(result.exitCode)
    expect(result.stdout).toMatch(/^(PASS|FAIL)\t/)
    expect(result.stdout).not.toContain("[object Object]")
  })

  test("plain serve status emits a stable record", () => {
    const result = runCli(
      target,
      ["--plain", "serve", "status", "--port", "49153"],
      baseEnv(artifactsDir, outDir, stateDir),
    )
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toMatch(/^STOPPED\t.*\tUNTRACKED\t--$/m)
  })

  test("plain serve stop emits a stable record", () => {
    const result = runCli(
      target,
      ["--plain", "serve", "stop", "--port", "49153"],
      baseEnv(artifactsDir, outDir, stateDir),
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/^NOOP\t.*\tnone\t--$/m)
  })

  test("plain bootstrap dry-run emits PASS/FAIL", () => {
    const { exitCode, stdout, stderr } = runCli(target, ["--plain", "bootstrap", "--dry-run"])
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    const lines = stdout.trim().split("\n")
    expect(lines[0]).toMatch(/^(PASS|FAIL)\tbun/)
    expect(lines[1]).toMatch(/^(PASS|FAIL)\tpnpm/)
  })
})
