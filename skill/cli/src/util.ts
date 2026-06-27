import { execSync } from "node:child_process"
import { fstatSync } from "node:fs"
import { basename, resolve } from "node:path"
import { readFile, stat } from "node:fs/promises"
import { mkdir } from "node:fs/promises"

export function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

export function deriveProjectName(projectPath: string): string {
  try {
    const topLevel = execSync("git rev-parse --show-toplevel", {
      cwd: projectPath,
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return sanitizeProjectName(basename(topLevel))
  } catch {
    return sanitizeProjectName(basename(projectPath))
  }
}

function stdinHasReadableSource(): boolean {
  if (process.stdin.isTTY === false) return true
  try {
    const stats = fstatSync(0)
    return stats.isFIFO() || stats.isFile() || stats.isSocket()
  } catch {
    return false
  }
}

async function readStdin(): Promise<string> {
  const reader = Bun.stdin.stream().getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const decoder = new TextDecoder("utf8")
  return chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode()
}

export async function readStdinOrFile(inputPath?: string): Promise<string> {
  if (inputPath === "-") return readStdin()
  if (inputPath) return readFile(resolve(inputPath), "utf8")
  if (stdinHasReadableSource()) {
    const raw = await readStdin()
    if (raw.length > 0) return raw
  }
  throw new Error("No input provided. Pass a file path or pipe JSON to stdin.")
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

export async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

export function isKebabCase(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}
