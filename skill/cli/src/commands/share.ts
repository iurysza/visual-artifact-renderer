import { execSync } from "node:child_process"
import { loadConfig, localBaseUrl } from "../config.ts"
import type { Logger } from "../logger.ts"

function tailscaleInstalled(): boolean {
  try {
    execSync("tailscale version", { encoding: "utf8", timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function tailnetDns(): string | null {
  try {
    const output = execSync("tailscale status --json", { encoding: "utf8", timeout: 3000 })
    const status = JSON.parse(output) as { Self?: { DNSName?: string } }
    const dns = status.Self?.DNSName
    if (typeof dns === "string" && dns.length > 0) {
      return dns.endsWith(".") ? dns.slice(0, -1) : dns
    }
  } catch {
    // ignore
  }
  return null
}

function tailnetBaseUrl(): string | null {
  const dns = tailnetDns()
  return dns ? `https://${dns}/artifacts` : null
}

function serverRunning(): Promise<boolean> {
  const config = loadConfig()
  const url = localBaseUrl(config)
  return fetch(url, { method: "HEAD" })
    .then((r) => r.ok)
    .catch(() => false)
}

export async function shareStatus(log: Logger): Promise<number> {
  const installed = tailscaleInstalled()
  const dns = tailnetDns()
  const base = tailnetBaseUrl()
  const running = await serverRunning()
  let reachable = false
  if (base) {
    try {
      const response = await fetch(`${base}/`, { method: "HEAD" })
      reachable = response.ok
    } catch {
      reachable = false
    }
  }

  log.output({
    tailscaleInstalled: installed,
    tailnetHost: dns,
    tailnetBaseUrl: base,
    serverRunning: running,
    artifactsReachable: reachable,
  })
  return 0
}

export async function shareUrl(project: string | undefined, slug: string | undefined, log: Logger): Promise<number> {
  const base = tailnetBaseUrl()
  if (!base) {
    log.error("Tailscale is not installed or not running")
    return 1
  }
  if (project && slug) {
    log.outputText(`${base}/${project}/${slug}/`)
  } else {
    log.outputText(`${base}/`)
  }
  return 0
}

export async function shareSetup(dryRun: boolean, force: boolean, log: Logger): Promise<number> {
  if (!tailscaleInstalled()) {
    log.error("Tailscale is not installed")
    return 1
  }

  const config = loadConfig()
  const backend = `http://127.0.0.1:${config.port}/artifacts`
  const command = `tailscale serve --yes --bg --https 443 --set-path /artifacts/ ${backend}`

  if (dryRun || !force) {
    log.log(command)
    if (!force) {
      log.info("Pass --force to run this command")
    }
    return 0
  }

  try {
    execSync(command, { encoding: "utf8", timeout: 10000 })
    const base = tailnetBaseUrl()
    log.output({ ok: true, tailnetBaseUrl: base })
    return 0
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
