#!/usr/bin/env tsx
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  createExtractorContext,
  ensureContextDirs,
  fileExists,
  readJson,
  writePacket,
} from "../../../lib/runner"
import { VisualArtifactReportPacket } from "../../../../../src/lib/report-packet"

interface RepoProfileFacts extends Record<string, unknown> {
  packageManager: "pnpm" | "npm" | "yarn" | "bun" | "unknown"
  framework: string[]
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  entryPoints: string[]
  testCommands: string[]
  routes?: string[]
  hasTypeScript: boolean
  hasLint: boolean
  hasTests: boolean
  nodeVersion?: string
}

async function detectPackageManager(repoRoot: string): Promise<RepoProfileFacts["packageManager"]> {
  if (await fileExists(path.join(repoRoot, "pnpm-lock.yaml"))) return "pnpm"
  if (await fileExists(path.join(repoRoot, "package-lock.json"))) return "npm"
  if (await fileExists(path.join(repoRoot, "yarn.lock"))) return "yarn"
  if (await fileExists(path.join(repoRoot, "bun.lockb"))) return "bun"
  if (await fileExists(path.join(repoRoot, "bun.lock"))) return "bun"
  return "unknown"
}

async function readPackageJson(repoRoot: string) {
  return readJson<{
    name?: string
    version?: string
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    engines?: { node?: string }
  }>(path.join(repoRoot, "package.json"))
}

function detectFrameworks(packageJson: Awaited<ReturnType<typeof readPackageJson>>): string[] {
  if (!packageJson) return []
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
  const frameworks: string[] = []
  const frameworkMap: Record<string, string> = {
    next: "Next.js",
    react: "React",
    vue: "Vue",
    svelte: "Svelte",
    angular: "Angular",
    "@base-ui/react": "Base UI",
    "@radix-ui/react": "Radix UI",
    "@shadcn/ui": "shadcn/ui",
    tailwindcss: "Tailwind CSS",
    express: "Express",
    fastify: "Fastify",
    nestjs: "NestJS",
    django: "Django",
    flask: "Flask",
    "@adonisjs/core": "AdonisJS",
  }
  for (const [dep, name] of Object.entries(frameworkMap)) {
    if (deps[dep]) frameworks.push(name)
  }
  if (deps["shadcn"] || deps["@shadcn/ui"]) frameworks.push("shadcn/ui")
  return Array.from(new Set(frameworks))
}

async function findEntryPoints(repoRoot: string): Promise<string[]> {
  const candidates = [
    "src/index.ts",
    "src/index.tsx",
    "src/main.ts",
    "src/main.tsx",
    "src/app.ts",
    "src/app.tsx",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "app.ts",
    "app.tsx",
    "index.ts",
    "index.tsx",
    "index.js",
    "src/server.ts",
    "src/server.tsx",
    "server.ts",
    "server.tsx",
  ]
  const found: string[] = []
  for (const candidate of candidates) {
    if (await fileExists(path.join(repoRoot, candidate))) {
      found.push(candidate)
    }
  }
  return found
}

function extractTestCommands(scripts: Record<string, string>): string[] {
  const testCommands: string[] = []
  for (const [name, command] of Object.entries(scripts)) {
    if (name.toLowerCase().includes("test") || name.toLowerCase().includes("spec")) {
      testCommands.push(`${name}: ${command}`)
    }
  }
  return testCommands
}

async function findNextRoutes(repoRoot: string): Promise<string[]> {
  const appDir = path.join(repoRoot, "src/app")
  const altAppDir = path.join(repoRoot, "app")
  const routes: string[] = []
  const targetDir = await fs.stat(appDir).then(s => s.isDirectory()).catch(() => false) ? appDir :
                    await fs.stat(altAppDir).then(s => s.isDirectory()).catch(() => false) ? altAppDir :
                    null
  if (!targetDir) return routes

  async function walk(dir: string, prefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith("(")) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath, path.join(prefix, entry.name))
      } else if (entry.name === "page.tsx" || entry.name === "page.ts" || entry.name === "page.jsx" || entry.name === "page.js") {
        const route = prefix.replace(/\\/g, "/") || "/"
        routes.push(route)
      }
    }
  }

  await walk(targetDir, "")
  return routes
}

export async function runRepoProfileExtractor(repoRoot: string, slug: string, outputBase?: string): Promise<VisualArtifactReportPacket> {
  const context = createExtractorContext(repoRoot, slug, outputBase)
  await ensureContextDirs(context)

  const packageManager = await detectPackageManager(repoRoot)
  const packageJson = await readPackageJson(repoRoot)
  const frameworks = detectFrameworks(packageJson)
  const scripts = packageJson?.scripts ?? {}
  const dependencies = packageJson?.dependencies ?? {}
  const devDependencies = packageJson?.devDependencies ?? {}
  const entryPoints = await findEntryPoints(repoRoot)
  const testCommands = extractTestCommands(scripts)
  const routes = frameworks.includes("Next.js") ? await findNextRoutes(repoRoot) : []
  const hasTypeScript = await fileExists(path.join(repoRoot, "tsconfig.json"))
  const hasLint = await fileExists(path.join(repoRoot, "eslint.config.mjs")) ||
                  await fileExists(path.join(repoRoot, "eslint.config.js")) ||
                  await fileExists(path.join(repoRoot, ".eslintrc.json"))

  const facts: RepoProfileFacts = {
    packageManager,
    framework: frameworks,
    scripts,
    dependencies,
    devDependencies,
    entryPoints,
    testCommands,
    routes,
    hasTypeScript,
    hasLint,
    hasTests: testCommands.length > 0,
    nodeVersion: packageJson?.engines?.node,
  }

  await writePacket(context, {
    id: "repo-profile",
    kind: "repo-profile",
    title: "Repository profile",
    summary: `Profile of ${packageJson?.name ?? slug}: ${frameworks.join(", ") || "unknown framework"}, ${packageManager} package manager, ${Object.keys(dependencies).length} dependencies, ${entryPoints.length} candidate entry points.`,
    facts,
    findings: [
      {
        title: frameworks.length > 0 ? `Detected frameworks: ${frameworks.join(", ")}` : "No major framework detected",
        evidence: Object.keys({ ...dependencies, ...devDependencies }).slice(0, 20),
        confidence: frameworks.length > 0 ? "high" : "medium",
      },
      {
        title: `Package manager: ${packageManager}`,
        evidence: [packageManager === "unknown" ? "No lockfile found" : `Lockfile present (${packageManager})`],
        confidence: packageManager === "unknown" ? "low" : "high",
      },
      {
        title: `Test commands: ${testCommands.length > 0 ? testCommands.join(", ") : "none found"}`,
        evidence: Object.keys(scripts),
        confidence: testCommands.length > 0 ? "high" : "medium",
      },
    ],
    assets: [],
  })

  return parseRepoProfilePacket(context)
}

async function parseRepoProfilePacket(context: ReturnType<typeof createExtractorContext>): Promise<VisualArtifactReportPacket> {
  const { readFile } = await import("node:fs/promises")
  const packetPath = path.join(context.packetsDir, "repo-profile.json")
  const raw = await readFile(packetPath, "utf8")
  return JSON.parse(raw) as VisualArtifactReportPacket
}

async function main() {
  const repoRoot = process.argv[2] ?? process.cwd()
  const slug = process.argv[3] ?? "repo-profile"
  const outputBase = process.argv[4]
  const packet = await runRepoProfileExtractor(repoRoot, slug, outputBase)
  console.log(JSON.stringify({ packetId: packet.id, outputDir: path.join(outputBase ?? path.join(process.cwd(), "ai-artifacts", "generated"), slug) }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
