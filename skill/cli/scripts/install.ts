import { cp, mkdir, rm, symlink, access, chmod } from "node:fs/promises"
import { constants } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import { homedir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DIST = resolve(ROOT, "dist")
const BINARY = resolve(DIST, "visual-artifact")
const OUT_DIR = resolve(DIST, "out")

const HOME = homedir()
const INSTALL_DIR = resolve(HOME, ".pi", "tools", "visual-artifact")
const INSTALL_OUT_DIR = resolve(INSTALL_DIR, "out")
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

  await mkdir(INSTALL_DIR, { recursive: true })
  await mkdir(BIN_DIR, { recursive: true })

  await rm(INSTALL_OUT_DIR, { recursive: true, force: true })
  await cp(BINARY, resolve(INSTALL_DIR, "visual-artifact"), { force: true })
  await cp(OUT_DIR, INSTALL_OUT_DIR, { recursive: true, force: true })
  await ensureExecutable(resolve(INSTALL_DIR, "visual-artifact"))

  await rm(BIN_LINK, { force: true })
  try {
    await symlink(resolve(INSTALL_DIR, "visual-artifact"), BIN_LINK)
  } catch {
    await cp(resolve(INSTALL_DIR, "visual-artifact"), BIN_LINK, { force: true })
  }
  await ensureExecutable(BIN_LINK)

  console.log(`[install] Binary: ${BIN_LINK}`)
  console.log(`[install] Assets:  ${INSTALL_OUT_DIR}`)

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
