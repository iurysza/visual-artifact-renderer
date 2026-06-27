import { loadConfig, localBaseUrl } from "../config.ts"
import type { Logger } from "../logger.ts"

export async function serveStatus(log: Logger): Promise<number> {
  const config = loadConfig()
  const url = localBaseUrl(config)

  try {
    const response = await fetch(url, { method: "HEAD" })
    if (response.ok) {
      log.output({ running: true, url })
      return 0
    }
    log.output({ running: false, url })
    return 1
  } catch {
    log.output({ running: false, url })
    return 1
  }
}
