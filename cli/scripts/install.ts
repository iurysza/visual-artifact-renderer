import { spawnSync } from "node:child_process"
import { access, chmod, copyFile, cp, lstat, mkdir, rm, writeFile } from "node:fs/promises"
import { constants, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { VERSION } from "../src/version.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DIST = resolve(ROOT, "dist")
const BINARY = resolve(DIST, "visual-artifact")

const HOME = homedir()
const BIN_DIR = resolve(HOME, ".local", "bin")
const BIN_PATH = resolve(BIN_DIR, "visual-artifact")
const DATA_DIR = resolve(HOME, ".local", "share", "visual-artifact")
const APP_OUT_DIR = resolve(DATA_DIR, "app", "out")
const VERSION_PATH = resolve(DATA_DIR, "VERSION")
const ARTIFACTS_DIR = resolve(HOME, ".agents", "skills", "visual-artifact", "artifacts")

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

async function copyAppOut(): Promise<void> {
  const source = resolve(DIST, "out")
  await assertReadable(source, "App static export")
  await rm(APP_OUT_DIR, { recursive: true, force: true })
  await mkdir(DATA_DIR, { recursive: true })
  await cp(source, APP_OUT_DIR, { recursive: true, force: true })
  console.log(`[install] App static export: ${APP_OUT_DIR}`)
}

async function writeVersionStamp(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(VERSION_PATH, `${VERSION}\n`)
  console.log(`[install] Version stamp: ${VERSION_PATH}`)
}

function stopInstalledServer(): void {
  if (!existsSync(BIN_PATH)) return
  const result = spawnSync(BIN_PATH, ["--quiet", "--json", "serve", "stop"], {
    encoding: "utf8",
    timeout: 10_000,
  })
  if (result.status !== 0) {
    throw new Error("Could not stop the existing renderer; no artifacts or runtime files were changed")
  }
}

async function main(): Promise<void> {
  console.log("[install] Installing visual-artifact...")

  if (!(await isWritable(BINARY))) {
    console.error(`[install] Binary not found or not executable: ${BINARY}`)
    console.error("          Run `bun run build` first.")
    process.exit(1)
  }

  stopInstalledServer()
  await mkdir(ARTIFACTS_DIR, { recursive: true })

  await copyFileReplacing(BINARY, BIN_PATH, "CLI binary")
  await ensureExecutable(BIN_PATH)
  await copyAppOut()
  await writeVersionStamp()
  console.log(`[install] Artifact store: ${ARTIFACTS_DIR}`)

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
