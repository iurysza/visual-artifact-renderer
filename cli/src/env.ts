import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

/**
 * Load a local `.env` file into process.env without overriding existing vars.
 *
 * This is a convenience for local development and testing. In CI or shared
 * environments, set secrets via the shell or a secrets manager instead.
 */
export async function loadEnvFile(cwd: string = process.cwd()): Promise<void> {
  try {
    const raw = await readFile(resolve(cwd, ".env"), "utf8")
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch {
    // .env is optional; ignore missing/unreadable files.
  }
}
