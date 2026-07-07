import { existsSync } from "node:fs"
import { readdir, rm } from "node:fs/promises"
import path from "node:path"

const ROUTE_STRATEGIES = ["zero-pages", "placeholder"] as const
type RouteStrategy = (typeof ROUTE_STRATEGIES)[number]

const PLACEHOLDER_PROJECT = process.env.VISUAL_ARTIFACT_CLOUD_PLACEHOLDER_PROJECT ?? "visualizer"
const PLACEHOLDER_SLUG = process.env.VISUAL_ARTIFACT_CLOUD_PLACEHOLDER_SLUG ?? "placeholder"

const outDir = path.resolve(process.env.VISUAL_ARTIFACT_OUT_DIR ?? path.join(process.cwd(), "out"))
const strategy = parseStrategy(process.env.VISUAL_ARTIFACT_CLOUD_ROUTE_STRATEGY)

async function main(): Promise<void> {
  if (!existsSync(outDir)) {
    fail(`Cloud build output directory does not exist: ${outDir}`)
  }

  const files = await listFiles(outDir)
  const missingShells = ["index.html", "shell-artifact/index.html", "shell-project/index.html"].filter(
    (file) => !files.includes(file),
  )
  if (missingShells.length > 0) {
    fail(`Cloud build is missing required shell files:\n${missingShells.map((file) => `- ${file}`).join("\n")}`)
  }

  const leaked = files.filter(isDynamicRouteLeak)
  if (leaked.length > 0) {
    fail(
      `Cloud build contains pre-rendered local artifact routes:\n${leaked
        .map((file) => `- ${file}`)
        .join("\n")}\nRebuild with VISUAL_ARTIFACT_CLOUD_BUILD=1.`,
    )
  }

  if (strategy === "zero-pages") {
    const placeholderDir = path.join(outDir, PLACEHOLDER_PROJECT)
    if (existsSync(placeholderDir)) {
      await rm(placeholderDir, { recursive: true, force: true })
      console.log(`Cloud build (${strategy}): pruned placeholder project ${PLACEHOLDER_PROJECT}`)
    }
  }

  console.log(`Cloud build leak check passed (${strategy})`)
}

function isDynamicRouteLeak(file: string): boolean {
  const segments = file.split("/")
  const [first] = segments

  if (!first) return false
  if (first.startsWith("_")) return false
  if (first === "shell-artifact" || first === "shell-project") return false
  if (first === "404.html" || first === "404" || first === "favicon.ico") return false
  if (file.endsWith(".txt") || segments.some((segment) => segment.startsWith("__next."))) return false
  if (file.endsWith(".svg")) return false
  if (segments.length === 1) return false

  if (first === PLACEHOLDER_PROJECT) {
    if (strategy === "placeholder") {
      const allowed = new Set([
        `${PLACEHOLDER_PROJECT}/index.html`,
        `${PLACEHOLDER_PROJECT}/index.txt`,
        `${PLACEHOLDER_PROJECT}/${PLACEHOLDER_SLUG}/index.html`,
        `${PLACEHOLDER_PROJECT}/${PLACEHOLDER_SLUG}/index.txt`,
      ])
      return !allowed.has(file)
    }
    // zero-pages: placeholder will be pruned; any other project is a leak.
    return false
  }

  return true
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        files.push(path.relative(root, fullPath).split(path.sep).join("/"))
      }
    }
  }

  await walk(root)
  return files.sort()
}

function parseStrategy(value: string | undefined): RouteStrategy {
  const strategy = value?.trim() || "zero-pages"
  if (ROUTE_STRATEGIES.includes(strategy as RouteStrategy)) return strategy as RouteStrategy
  fail(`Invalid VISUAL_ARTIFACT_CLOUD_ROUTE_STRATEGY: ${strategy}`)
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
