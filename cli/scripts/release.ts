import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import pkg from "../../package.json" with { type: "json" }

const VERSION: string = pkg.version

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const PROJECT_ROOT = resolve(ROOT, "..")
const APP_DIR = resolve(PROJECT_ROOT, "app")
const SHARED_DIR = resolve(PROJECT_ROOT, "shared")
const SKILL_DIR = resolve(PROJECT_ROOT, "skill")
const PI_EXTENSION_DIR = resolve(PROJECT_ROOT, "pi-extension")
const RELEASES_DIR = resolve(PROJECT_ROOT, "releases")

interface Target {
  id: string
  bunTarget: string
  os: string
  arch: string
}

const TARGETS: Target[] = [
  { id: "darwin-aarch64", bunTarget: "bun-darwin-arm64", os: "macos", arch: "aarch64" },
  { id: "darwin-x86_64", bunTarget: "bun-darwin-x64", os: "macos", arch: "x86_64" },
  { id: "linux-aarch64", bunTarget: "bun-linux-arm64", os: "linux", arch: "aarch64" },
  { id: "linux-x86_64", bunTarget: "bun-linux-x64", os: "linux", arch: "x86_64" },
]

function exec(cmd: string, cwd: string): void {
  console.log(`[release] ${cmd} (in ${cwd})`)
  execSync(cmd, { cwd, stdio: "inherit" })
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore", timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function gitRepoSlug(): string {
  try {
    const url = execSync("git remote get-url origin", { cwd: PROJECT_ROOT, encoding: "utf8", timeout: 5000 }).trim()
    // git@github.com:owner/repo.git -> owner/repo
    // https://github.com/owner/repo.git -> owner/repo
    const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (match) return `${match[1]}/${match[2]}`
  } catch {
    // ignore
  }
  return "iurysza/visual-artifact-renderer"
}

function assetUrl(slug: string, name: string): string {
  return `https://github.com/${slug}/releases/latest/download/${name}`
}

async function cleanReleasesDir(): Promise<void> {
  await rm(RELEASES_DIR, { recursive: true, force: true })
  await mkdir(RELEASES_DIR, { recursive: true })
}

async function installDependencies(): Promise<void> {
  if (!commandExists("pnpm")) {
    throw new Error("pnpm is required to build the renderer")
  }
  if (!commandExists("bun")) {
    throw new Error("bun is required to compile the CLI")
  }
  exec("pnpm install", APP_DIR)
  exec("bun install", SHARED_DIR)
  exec("bun run build", SHARED_DIR)
  exec("bun install", ROOT)
}

async function buildApp(): Promise<void> {
  exec("pnpm build", APP_DIR)
  exec("pnpm export:contract", APP_DIR)
}

async function buildCliBinary(target: Target, outPath: string): Promise<void> {
  if (!commandExists("bun")) {
    throw new Error("bun is required to compile the CLI")
  }
  const entry = resolve(ROOT, "src", "main.ts")
  exec(`bun build --compile --target=${target.bunTarget} ${entry} --outfile ${outPath}`, ROOT)

  console.log(`[release] Smoke testing ${target.id} binary...`)
  execSync(`${outPath} contract --format summary`, { cwd: ROOT, stdio: "pipe" })
  console.log(`[release] Smoke test passed for ${target.id}`)
}

async function copySupportingFiles(buildDir: string): Promise<void> {
  const appOutDir = resolve(APP_DIR, "out")
  if (!existsSync(appOutDir)) {
    throw new Error(`App static export missing: ${appOutDir}. Run pnpm build in app/ first.`)
  }
  await cp(appOutDir, resolve(buildDir, "out"), { recursive: true, force: true })
  await cp(SKILL_DIR, resolve(buildDir, "skill"), { recursive: true, force: true })
  await cp(PI_EXTENSION_DIR, resolve(buildDir, "pi-extension"), { recursive: true, force: true })
}

async function createArchive(target: Target, buildDir: string): Promise<string> {
  const archiveName = `visual-artifact-${target.os}-${target.arch}.tar.gz`
  const archivePath = resolve(RELEASES_DIR, archiveName)

  // Package under a single top-level directory so the installer can find things predictably.
  const packageName = `visual-artifact-${VERSION}-${target.id}`
  const packageDir = resolve(RELEASES_DIR, "_build", packageName)
  await mkdir(packageDir, { recursive: true })

  const entries = await readdir(buildDir)
  for (const entry of entries) {
    if (entry === packageName) continue
    await cp(resolve(buildDir, entry), resolve(packageDir, entry), { recursive: true, force: true })
  }

  exec(`tar -czf ${archivePath} -C ${resolve(RELEASES_DIR, "_build")} ${packageName}`, PROJECT_ROOT)
  return archiveName
}

async function main(): Promise<void> {
  const repoSlug = gitRepoSlug()
  console.log(`[release] Repository: ${repoSlug}`)

  await installDependencies()
  await buildApp()
  await cleanReleasesDir()

  const manifest: {
    version: string
    released_at: string
    repository: string
    assets: Record<string, string>
  } = {
    version: VERSION,
    released_at: new Date().toISOString(),
    repository: `https://github.com/${repoSlug}`,
    assets: {},
  }

  for (const target of TARGETS) {
    console.log(`[release] Building ${target.id}...`)
    const buildDir = resolve(RELEASES_DIR, "_build", target.id)
    await mkdir(buildDir, { recursive: true })

    const binaryPath = resolve(buildDir, "visual-artifact")
    await buildCliBinary(target, binaryPath)
    await copySupportingFiles(buildDir)

    const archiveName = await createArchive(target, buildDir)
    manifest.assets[`${target.os}-${target.arch}`] = assetUrl(repoSlug, archiveName)
    console.log(`[release] Created ${archiveName}`)
  }

  const manifestPath = resolve(RELEASES_DIR, "latest.json")
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`[release] Manifest: ${manifestPath}`)

  // Copy install.sh so it can be attached to the release or served from the same directory.
  const installScriptSource = resolve(PROJECT_ROOT, "install.sh")
  if (existsSync(installScriptSource)) {
    await cp(installScriptSource, resolve(RELEASES_DIR, "install.sh"), { force: true })
    console.log("[release] Copied install.sh")
  }

  // Clean up intermediate build directory.
  await rm(resolve(RELEASES_DIR, "_build"), { recursive: true, force: true })

  console.log(`[release] Done. Output in ${RELEASES_DIR}`)
  console.log(`[release] Next steps:`)
  console.log(`          1. Tag a release: git tag v${VERSION} && git push origin v${VERSION}`)
  console.log(`          2. Upload the contents of ${RELEASES_DIR} to the GitHub release assets.`)
  console.log(`          3. Share the install command:`)
  console.log(`             curl -fsSL https://github.com/${repoSlug}/releases/latest/download/install.sh | sh`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
