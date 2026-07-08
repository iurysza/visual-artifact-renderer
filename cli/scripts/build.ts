import { cp, mkdir, rm, readdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DIST = resolve(ROOT, "dist")

async function cleanStaleBunBuildFiles(): Promise<void> {
  const files = await readdir(ROOT)
  const stale = files.filter((f) => f.endsWith(".bun-build"))
  if (stale.length === 0) return
  console.log(`[build] Cleaning ${stale.length} stale .bun-build file(s)...`)
  await Promise.all(stale.map((f) => rm(resolve(ROOT, f), { force: true })))
}

function findProjectRoot(): string {
  let dir = resolve(ROOT, "..")
  for (let i = 0; i < 4; i++) {
    if (
      existsSync(resolve(dir, "app")) &&
      existsSync(resolve(dir, "cli")) &&
      existsSync(resolve(dir, "shared")) &&
      existsSync(resolve(dir, "skill", "SKILL.md"))
    ) {
      return dir
    }
    dir = resolve(dir, "..")
  }
  throw new Error("Could not find project root (app/ + cli/ + shared/ + skill/SKILL.md). Build must run inside the visualizer repo.")
}

async function main(): Promise<void> {
  const projectRoot = findProjectRoot()
  const outSrc = resolve(projectRoot, "app", "out")

  console.log("[build] Cleaning dist...")
  await rm(DIST, { recursive: true, force: true })
  await mkdir(DIST, { recursive: true })

  await cleanStaleBunBuildFiles()

  console.log(`[build] Project root: ${projectRoot}`)

  if (existsSync(outSrc)) {
    await cp(outSrc, resolve(DIST, "out"), { recursive: true, force: true })
    console.log(`[build] Copied static export: ${outSrc}`)
  } else {
    console.warn(`[build] Static export missing: ${outSrc}`)
    console.warn("        The CLI will serve from app/out by default. Build the app with `pnpm build` in app/.")
  }

  console.log("[build] Compiling binary...")
  const binaryPath = resolve(DIST, "visual-artifact")
  try {
    execSync(`bun build --compile ${resolve(ROOT, "src", "main.ts")} --outfile ${binaryPath}`, {
      cwd: ROOT,
      stdio: "inherit",
    })
  } catch {
    process.exit(1)
  } finally {
    await cleanStaleBunBuildFiles()
  }

  console.log("[build] Smoke testing compiled binary...")
  try {
    execSync(`${binaryPath} contract --format summary`, { cwd: ROOT, stdio: "pipe" })
    console.log("[build] Smoke test passed")
  } catch {
    console.error("[build] Smoke test failed: compiled binary cannot print contract")
    process.exit(1)
  }

  console.log(`[build] Done: ${binaryPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
