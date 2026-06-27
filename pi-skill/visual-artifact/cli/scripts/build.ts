import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DIST = resolve(ROOT, "dist")
const ASSETS_SRC = resolve(ROOT, "src", "assets")

const VISUALIZER_ROOT = resolve(ROOT, "..", "..", "..", "..", "..", "vibe-coded", "visualizer")
const CONTRACT_SRC = resolve(VISUALIZER_ROOT, "artifact-contract.json")
const OUT_SRC = resolve(VISUALIZER_ROOT, "out")

async function findVisualizerRoot(): Promise<{ contract: string; out: string } | null> {
  const candidates = [
    VISUALIZER_ROOT,
    resolve(process.env.HOME ?? "", ".pi", "tools", "visualizer"),
    resolve(process.env.VISUALIZER_ROOT ?? ""),
  ]

  for (const root of candidates) {
    if (!root) continue
    const contract = resolve(root, "artifact-contract.json")
    const out = resolve(root, "out")
    try {
      await readFile(contract)
      return { contract, out }
    } catch {
      // try next
    }
  }
  return null
}

async function main(): Promise<void> {
  console.log("[build] Cleaning dist...")
  await rm(DIST, { recursive: true, force: true })
  await mkdir(DIST, { recursive: true })

  const visualizer = await findVisualizerRoot()
  if (!visualizer) {
    console.error("[build] Could not find visualizer root with artifact-contract.json")
    console.error("        Set VISUALIZER_ROOT or ensure ~/.pi/tools/visualizer exists.")
    process.exit(1)
  }

  console.log(`[build] Using contract: ${visualizer.contract}`)
  console.log(`[build] Using static export: ${visualizer.out}`)

  await mkdir(ASSETS_SRC, { recursive: true })
  await cp(visualizer.contract, resolve(ASSETS_SRC, "contract.json"), { force: true })
  await cp(visualizer.out, resolve(DIST, "out"), { recursive: true, force: true })

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
