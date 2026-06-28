import { mkdir, rm, symlink, access, chmod, lstat } from "node:fs/promises"
import { constants, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const SKILL_ROOT = resolve(ROOT, "..")
const REPO_ROOT = resolve(SKILL_ROOT, "..")
const DIST = resolve(ROOT, "dist")
const BINARY = resolve(DIST, "visual-artifact")

const HOME = homedir()
const BIN_DIR = resolve(HOME, ".pi", "bin")
const BIN_LINK = resolve(BIN_DIR, "visual-artifact")
const SKILL_LINK = resolve(HOME, ".pi", "skills", "visual-artifact")
const EXTENSION_LINK = resolve(HOME, ".pi", "agent", "extensions", "visual-artifact.ts")

function findExtensionSource(): string | null {
  const candidates = [
    resolve(REPO_ROOT, "pi-extension", "visual-artifact.ts"),
    resolve(SKILL_ROOT, "pi-extension", "visual-artifact.ts"),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
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

async function removeManagedSymlink(path: string, label: string): Promise<void> {
  try {
    const current = await lstat(path)
    if (!current.isSymbolicLink()) {
      throw new Error(`Refusing to replace non-symlink ${label}: ${path}`)
    }
    await rm(path, { force: true })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return
    throw error
  }
}

async function installManagedSymlink(source: string, target: string, label: string): Promise<void> {
  await assertReadable(source, label)
  await mkdir(dirname(target), { recursive: true })
  await removeManagedSymlink(target, label)
  await symlink(source, target)
  console.log(`[install] ${label} symlink: ${target} -> ${source}`)
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

  await mkdir(BIN_DIR, { recursive: true })

  await rm(BIN_LINK, { force: true })
  try {
    await symlink(BINARY, BIN_LINK)
  } catch (error) {
    console.error(`[install] Could not create binary symlink: ${BIN_LINK} -> ${BINARY}`)
    console.error("          visual-artifact must be symlinked so it can locate the skill app, artifacts, and contract.")
    console.error(error instanceof Error ? `          ${error.message}` : String(error))
    process.exit(1)
  }
  await ensureExecutable(BIN_LINK)

  console.log(`[install] Binary symlink: ${BIN_LINK} -> ${BINARY}`)

  try {
    await installManagedSymlink(SKILL_ROOT, SKILL_LINK, "Skill")
    await installManagedSymlink(extensionSource, EXTENSION_LINK, "Pi extension")
  } catch (error) {
    console.error(`[install] ${error instanceof Error ? error.message : String(error)}`)
    console.error("          Remove the existing path manually if you want visual-artifact to manage it.")
    process.exit(1)
  }

  const pathEnv = process.env.PATH ?? ""
  if (!pathEnv.split(":").includes(BIN_DIR)) {
    console.warn(`[install] ${BIN_DIR} is not in PATH. Add it to your shell profile:`)
    console.warn(`          export PATH="${BIN_DIR}:$PATH"`)
  } else {
    console.log("[install] Run `visual-artifact --help` to verify.")
  }

  console.log("[install] Run `/reload` in Pi, or restart Pi, to load the visual-artifact extension.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
