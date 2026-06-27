import { spawn } from "node:child_process"
import { loadConfig, localBaseUrl } from "../config.ts"
import type { Logger } from "../logger.ts"

export async function openArtifact(target: string | undefined, log: Logger): Promise<number> {
  const config = loadConfig()

  if (!target) {
    const url = localBaseUrl(config)
    openBrowser(url)
    log.outputText(url)
    return 0
  }

  const parts = target.replace(/\/$/, "").split("/")
  if (parts.length !== 2) {
    log.error("Target must be <project>/<slug>")
    return 2
  }

  const [project, slug] = parts
  const url = `${localBaseUrl(config)}/${project}/${slug}/`
  openBrowser(url)
  log.outputText(url)
  return 0
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
  const child = spawn(command, [url], { detached: true, stdio: "ignore" })
  child.unref()
}
