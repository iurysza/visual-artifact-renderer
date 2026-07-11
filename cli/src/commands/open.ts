import { spawn } from "node:child_process"
import { artifactBaseUrl, ConfigValidationError, loadConfig } from "../config.ts"
import type { Logger, ResultData } from "../logger.ts"

export async function openArtifact(target: string | undefined, log: Logger): Promise<number> {
  let config
  try {
    config = loadConfig()
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }

  if (!target) {
    const url = artifactBaseUrl(config)
    openBrowser(url)
    const result: ResultData = { command: "open", url }
    log.result(result)
    return 0
  }

  const parts = target.replace(/\/$/, "").split("/")
  if (parts.length !== 2) {
    log.error("Target must be <project>/<slug>")
    return 2
  }

  const [project, slug] = parts
  const url = `${artifactBaseUrl(config)}/${project}/${slug}/`
  openBrowser(url)
  const result: ResultData = { command: "open", url, project, slug }
  log.result(result)
  return 0
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
  const child = spawn(command, [url], { detached: true, stdio: "ignore" })
  child.unref()
}
