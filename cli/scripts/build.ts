import { cp, mkdir, rm, readFile, readdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DIST = resolve(ROOT, "dist")
const ASSETS_SRC = resolve(ROOT, "src", "assets")

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
  const contractSrc = resolve(projectRoot, "cli", "assets", "contract.json")
  const outSrc = resolve(projectRoot, "app", "out")

  console.log("[build] Cleaning dist...")
  await rm(DIST, { recursive: true, force: true })
  await mkdir(DIST, { recursive: true })

  await cleanStaleBunBuildFiles()

  console.log(`[build] Project root: ${projectRoot}`)

  await mkdir(ASSETS_SRC, { recursive: true })

  try {
    await readFile(contractSrc)
    await cp(contractSrc, resolve(ASSETS_SRC, "contract.json"), { force: true })
    console.log(`[build] Bundled contract: ${contractSrc}`)
  } catch {
    console.error(`[build] contract.json not found at ${contractSrc}`)
    console.error("        Run `pnpm export:contract` in the app/ directory first.")
    process.exit(1)
  }

  if (existsSync(outSrc)) {
    await cp(outSrc, resolve(DIST, "out"), { recursive: true, force: true })
    console.log(`[build] Copied static export: ${outSrc}`)
  } else {
    console.warn(`[build] Static export missing: ${outSrc}`)
    console.warn("        The CLI will serve from app/out by default. Build the app with `pnpm build` in app/.")
  }

  console.log("[build] Compiling binary...")
  try {
    execSync(`bun build --compile ${resolve(ROOT, "src", "main.ts")} --outfile ${resolve(DIST, "visual-artifact")}`, {
      cwd: ROOT,
      stdio: "inherit",
    })
  } catch {
    process.exit(1)
  } finally {
    await cleanStaleBunBuildFiles()
  }

  console.log(`[build] Done: ${resolve(DIST, "visual-artifact")}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
