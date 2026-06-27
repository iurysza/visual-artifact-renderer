import { homedir } from "node:os"
import { resolve } from "node:path"
import type { Config } from "./types.ts"

export const DEFAULT_PORT = 9999
export const DEFAULT_HOST = "0.0.0.0"
export const DEFAULT_MOUNT_PATH = "/artifacts"
export const DEFAULT_DATA_PATH = "/data/artifacts"
export const DEFAULT_ARTIFACTS_DIR = resolve(homedir(), ".pi", "artifacts")
export const DEFAULT_OUT_DIR = resolve(homedir(), ".pi", "tools", "visual-artifact", "out")

export function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2))
  }
  return resolve(path)
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  return {
    artifactsDir: expandHome(process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR ?? DEFAULT_ARTIFACTS_DIR),
    outDir: expandHome(process.env.VISUAL_ARTIFACT_OUT_DIR ?? DEFAULT_OUT_DIR),
    port: parseInt(process.env.VISUAL_ARTIFACT_PORT ?? String(DEFAULT_PORT), 10),
    host: process.env.VISUAL_ARTIFACT_HOST ?? DEFAULT_HOST,
    mountPath: process.env.VISUAL_ARTIFACT_MOUNT_PATH ?? DEFAULT_MOUNT_PATH,
    dataPath: process.env.VISUAL_ARTIFACT_DATA_PATH ?? DEFAULT_DATA_PATH,
    open: (process.env.VISUAL_ARTIFACT_OPEN ?? "1") === "1",
    baseUrl: process.env.VISUAL_ARTIFACT_BASE_URL,
    ...overrides,
  }
}

export function localBaseUrl(config: Config): string {
  return `http://${config.host === "0.0.0.0" ? "127.0.0.1" : config.host}:${config.port}${config.mountPath}`
}
