import { execSync } from "node:child_process"
import { constants, fstatSync } from "node:fs"
import { basename, resolve } from "node:path"
import { open, stat } from "node:fs/promises"
import { mkdir } from "node:fs/promises"

import { RAW_ARTIFACT_MAX_BYTES } from "@agents/visual-artifact-annotations/contract"

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

async function readStdinBounded(maxBytes: number): Promise<string> {
  const reader = Bun.stdin.stream().getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        throw new Error(
          `stdin exceeds ${maxBytes} bytes (artifact limit)`,
        )
      }
      chunks.push(value)
    }
  }
  const decoder = new TextDecoder("utf8")
  return chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode()
}

async function readFileBounded(filePath: string, maxBytes: number): Promise<string> {
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NONBLOCK)
  try {
    const fileStats = await handle.stat()
    if (!fileStats.isFile()) {
      throw new Error(`${filePath} is not a regular file`)
    }
    const buffer = Buffer.alloc(maxBytes + 1)
    let totalBytes = 0
    while (totalBytes < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        totalBytes,
        buffer.length - totalBytes,
        totalBytes,
      )
      if (bytesRead === 0) break
      totalBytes += bytesRead
    }
    if (totalBytes > maxBytes) {
      throw new Error(`${filePath} is larger than ${maxBytes} bytes`)
    }
    return buffer.subarray(0, totalBytes).toString("utf8")
  } finally {
    await handle.close()
  }
}

export async function readStdinOrFile(
  inputPath?: string,
  maxBytes: number = RAW_ARTIFACT_MAX_BYTES,
): Promise<string> {
  if (inputPath === "-") return readStdinBounded(maxBytes)
  if (inputPath) {
    const filePath = resolve(inputPath)
    return readFileBounded(filePath, maxBytes)
  }
  if (stdinHasReadableSource()) {
    const raw = await readStdinBounded(maxBytes)
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
