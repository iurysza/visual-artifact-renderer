import { access, chmod, copyFile, cp, lstat, mkdir, readdir, realpath, rm } from "node:fs/promises"
import { constants, existsSync } from "node:fs"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const SKILL_ROOT = resolve(ROOT, "..")
const REPO_ROOT = resolve(SKILL_ROOT, "..")
const DIST = resolve(ROOT, "dist")
const BINARY = resolve(DIST, "visual-artifact")

const HOME = homedir()
const BIN_DIR = resolve(HOME, ".local", "bin")
const BIN_PATH = resolve(BIN_DIR, "visual-artifact")
const SKILL_TARGET = resolve(HOME, ".agents", "skills", "visual-artifact")
const PI_AGENT_DIR = resolve(HOME, ".pi", "agent")
const EXTENSION_TARGET = resolve(PI_AGENT_DIR, "extensions", "visual-artifact.ts")
const INSTALLED_EXTENSION_SOURCE = resolve(SKILL_TARGET, "pi-extension", "visual-artifact.ts")

function findExtensionSource(): string | null {
  const candidates = [
    resolve(REPO_ROOT, "pi-extension", "visual-artifact.ts"),
    resolve(SKILL_ROOT, "pi-extension", "visual-artifact.ts"),
    EXTENSION_TARGET,
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function shouldCopySkillPath(source: string): boolean {
  const path = relative(SKILL_ROOT, source)
  if (!path) return true
  const parts = path.split(sep)
  if (parts.includes("node_modules")) return false
  if (parts.includes(".next")) return false
  if (parts[0] === "artifacts") return parts.length === 1 || parts[1] === ".gitignore" || parts[1] === ".gitkeep"
  if (parts[0] === "cli" && parts[1] === "dist") return false
  return true
}

async function ensureExecutable(path: string): Promise<void> {
  try {
    await chmod(path, 0o755)
  } catch {
    // ignore
  }
}

async function isWritable(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

async function assertReadable(path: string, label: string): Promise<void> {
  try {
    await access(path, constants.R_OK)
  } catch {
    throw new Error(`${label} not found or not readable: ${path}`)
  }
}

async function samePath(a: string, b: string): Promise<boolean> {
  try {
    return (await realpath(a)) === (await realpath(b))
  } catch {
    return resolve(a) === resolve(b)
  }
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink()
  } catch {
    return false
  }
}

async function removePathOrSymlink(path: string): Promise<void> {
  try {
    const current = await lstat(path)
    await rm(path, { recursive: current.isDirectory() && !current.isSymbolicLink(), force: true })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return
    throw error
  }
}

async function copyFileReplacing(source: string, target: string, label: string): Promise<void> {
  await assertReadable(source, label)
  await mkdir(dirname(target), { recursive: true })
  await removePathOrSymlink(target)
  await copyFile(source, target)
  console.log(`[install] ${label}: ${target}`)
}

async function prepareSkillTarget(target: string): Promise<void> {
  try {
    const current = await lstat(target)
    if (current.isSymbolicLink() || !current.isDirectory()) {
      await rm(target, { force: true })
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error
  }

  await mkdir(target, { recursive: true })
  const entries = await readdir(target, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === "artifacts") continue
    await rm(resolve(target, entry.name), { recursive: true, force: true })
  }
}

async function copyExtensionIntoSkill(extensionSource: string): Promise<void> {
  if (await samePath(extensionSource, INSTALLED_EXTENSION_SOURCE)) return
  await mkdir(dirname(INSTALLED_EXTENSION_SOURCE), { recursive: true })
  await copyFile(extensionSource, INSTALLED_EXTENSION_SOURCE)
}

async function installSkill(extensionSource: string): Promise<void> {
  await assertReadable(resolve(SKILL_ROOT, "SKILL.md"), "Skill")

  if (!(await isSymlink(SKILL_TARGET)) && await samePath(SKILL_ROOT, SKILL_TARGET)) {
    await copyExtensionIntoSkill(extensionSource)
    console.log(`[install] Skill already installed: ${SKILL_TARGET}`)
    return
  }

  await prepareSkillTarget(SKILL_TARGET)
  await cp(SKILL_ROOT, SKILL_TARGET, {
    recursive: true,
    force: true,
    filter: shouldCopySkillPath,
  })
  await copyExtensionIntoSkill(extensionSource)
  console.log(`[install] Skill copy: ${SKILL_TARGET}`)
}

async function main(): Promise<void> {
  console.log("[install] Installing visual-artifact...")

  if (!(await isWritable(BINARY))) {
    console.error(`[install] Binary not found or not executable: ${BINARY}`)
    console.error("          Run `bun run build` first.")
    process.exit(1)
  }

  const extensionSource = findExtensionSource()
  if (!extensionSource) {
    console.error("[install] Pi extension source not found: pi-extension/visual-artifact.ts")
    process.exit(1)
  }

  await copyFileReplacing(BINARY, BIN_PATH, "CLI binary")
  await ensureExecutable(BIN_PATH)
  await installSkill(extensionSource)

  if (existsSync(PI_AGENT_DIR)) {
    await copyFileReplacing(extensionSource, EXTENSION_TARGET, "Pi extension")
    console.log("[install] Run `/reload` in Pi, or restart Pi, to load the visual-artifact extension.")
  } else {
    console.log("[install] Pi not detected; skipped Pi extension copy.")
  }

  const pathEnv = process.env.PATH ?? ""
  if (!pathEnv.split(":").includes(BIN_DIR)) {
    console.warn(`[install] ${BIN_DIR} is not in PATH. Add it to your shell profile:`)
    console.warn(`          export PATH="${BIN_DIR}:$PATH"`)
  } else {
    console.log("[install] Run `visual-artifact --help` to verify.")
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
