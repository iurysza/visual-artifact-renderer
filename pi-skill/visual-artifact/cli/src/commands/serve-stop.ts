import { loadConfig, localBaseUrl } from "../config.ts"
import type { Logger } from "../logger.ts"

export async function serveStop(log: Logger): Promise<number> {
  const config = loadConfig()
  const url = localBaseUrl(config)

  try {
    const response = await fetch(`${url}/data/artifacts/index.json`, { method: "GET" })
    if (!response.ok) {
      log.info("Server is not running")
      return 0
    }
  } catch {
    log.info("Server is not running")
    return 0
  }

  log.error("Cannot automatically stop the server because the running process is not tracked. " +
    `Find the process listening on ${config.host}:${config.port} and kill it manually, ` +
    `or start the server with a process manager.`)
  return 1
}
