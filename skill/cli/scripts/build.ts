import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DIST = resolve(ROOT, "dist")
const ASSETS_SRC = resolve(ROOT, "src", "assets")

function findSkillRoot(): string {
  let dir = resolve(ROOT, "..")
  for (let i = 0; i < 3; i++) {
    if (existsSync(resolve(dir, "SKILL.md"))) return dir
    dir = resolve(dir, "..")
  }
  throw new Error("Could not find skill root (SKILL.md). Build must run inside the skill directory.")
}

async function main(): Promise<void> {
  const skillRoot = findSkillRoot()
  const contractSrc = resolve(skillRoot, "artifact-contract.json")
  const outSrc = resolve(skillRoot, "app", "out")

  console.log("[build] Cleaning dist...")
  await rm(DIST, { recursive: true, force: true })
  await mkdir(DIST, { recursive: true })

  console.log(`[build] Skill root: ${skillRoot}`)

  await mkdir(ASSETS_SRC, { recursive: true })

  try {
    await readFile(contractSrc)
    await cp(contractSrc, resolve(ASSETS_SRC, "contract.json"), { force: true })
    console.log(`[build] Bundled contract: ${contractSrc}`)
  } catch {
    console.error(`[build] artifact-contract.json not found at ${contractSrc}`)
    console.error("        Run `pnpm export:contract` in the skill/app directory first.")
    process.exit(1)
  }

  if (existsSync(outSrc)) {
    await cp(outSrc, resolve(DIST, "out"), { recursive: true, force: true })
    console.log(`[build] Copied static export: ${outSrc}`)
  } else {
    console.warn(`[build] Static export missing: ${outSrc}`)
    console.warn("        The CLI will serve from skill/app/out by default. Build the app with `pnpm build` in skill/app.")
  }

  console.log("[build] Compiling binary...")
  try {
    execSync(`bun build --compile ${resolve(ROOT, "src", "main.ts")} --outfile ${resolve(DIST, "visual-artifact")}`, {
      cwd: ROOT,
      stdio: "inherit",
    })
  } catch {
    process.exit(1)
  }

  console.log(`[build] Done: ${resolve(DIST, "visual-artifact")}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
