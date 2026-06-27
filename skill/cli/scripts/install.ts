import { mkdir, rm, symlink, access, chmod } from "node:fs/promises"
import { constants } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DIST = resolve(ROOT, "dist")
const BINARY = resolve(DIST, "visual-artifact")

const HOME = homedir()
const BIN_DIR = resolve(HOME, ".pi", "bin")
const BIN_LINK = resolve(BIN_DIR, "visual-artifact")

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

async function main(): Promise<void> {
  console.log("[install] Installing visual-artifact...")

  if (!(await isWritable(BINARY))) {
    console.error(`[install] Binary not found or not executable: ${BINARY}`)
    console.error("          Run `bun run build` first.")
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
