import type { GlobalOpts } from "./types.ts"

export interface ResultData {
  command: string
  [key: string]: unknown
}

function colorEnabled(stream: NodeJS.WriteStream, noColor: boolean): boolean {
  if (noColor) return false
  if (process.env.NO_COLOR !== undefined) return false
  if (process.env.TERM?.toLowerCase() === "dumb") return false
  return stream.isTTY ?? false
}

function colorize(code: string, text: string, enabled: boolean): string {
  if (!enabled) return text
  return `\x1b[${code}m${text}\x1b[0m`
}

export class Logger {
  private opts: GlobalOpts
  private stderrColor: boolean
  private startTime: number

  constructor(opts: GlobalOpts) {
    this.opts = opts
    this.stderrColor = colorEnabled(process.stderr, opts.noColor)
    this.startTime = performance.now()
  }

  private elapsed(): string {
    return `${(performance.now() - this.startTime).toFixed(1)}ms`
  }

  private diagnostic(method: "log" | "info" | "warn" | "error" | "debug" | "success", message: string): void {
    if (this.opts.quiet && method !== "error") return
    let prefix = ""
    let code = "0"
    switch (method) {
      case "info":
        prefix = "info: "
        code = "34"
        break
      case "warn":
        prefix = "warn: "
        code = "33"
        break
      case "error":
        prefix = "error: "
        code = "31"
        break
      case "debug":
        prefix = "debug: "
        code = "90"
        break
      case "success":
        code = "32"
        break
    }
    const elapsed = this.opts.verbose ? ` [${this.elapsed()}]` : ""
    process.stderr.write(`${colorize(code, prefix + message + elapsed, this.stderrColor)}\n`)
  }

  log(message: string): void {
    this.diagnostic("log", message)
  }

  info(message: string): void {
    this.diagnostic("info", message)
  }

  warn(message: string): void {
    this.diagnostic("warn", message)
  }

  error(message: string, error?: unknown): void {
    if (this.opts.verbose && error !== undefined) {
      const stack =
        error && typeof error === "object" && "stack" in error && typeof error.stack === "string"
          ? error.stack
          : new Error(message).stack
      if (stack) {
        this.diagnostic("error", `${message}\n${stack}`)
        return
      }
    }
    this.diagnostic("error", message)
  }

  debug(message: string): void {
    if (!this.opts.verbose) return
    this.diagnostic("debug", message)
  }

  success(message: string): void {
    this.diagnostic("success", message)
  }

  rawDiagnostic(text: string): void {
    if (this.opts.quiet || !text) return
    process.stderr.write(text.endsWith("\n") ? text : `${text}\n`)
  }

  result(data: ResultData, humanOverride?: string): void {
    if (this.opts.json) {
      process.stdout.write(`${JSON.stringify({ schemaVersion: 1, ...data }, null, 2)}\n`)
      return
    }
    if (this.opts.plain) {
      const lines = formatPlainRecords(data)
      if (lines.length > 0) process.stdout.write(`${lines.join("\n")}\n`)
      return
    }
    const human = humanOverride ?? formatHumanResult(data)
    if (human) process.stdout.write(`${human}\n`)
  }

}

function sanitizePlainField(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).replace(/[\t\r\n]+/g, " ")
}

export function formatPlainRecords(data: ResultData): string[] {
  const { command, ...rest } = data
  switch (command) {
    case "create":
    case "open":
    case "serve":
      if (rest.dryRun && command === "create") {
        const { slug, totalNodes, datasetCount } = rest
        return [`VALID\t${sanitizePlainField(slug)}\t${sanitizePlainField(totalNodes)}\t${sanitizePlainField(datasetCount)}`]
      }
      return [sanitizePlainField(rest.url)]
    case "validate": {
      const { slug, totalNodes, datasetCount } = rest
      return [`VALID\t${sanitizePlainField(slug)}\t${sanitizePlainField(totalNodes)}\t${sanitizePlainField(datasetCount)}`]
    }
    case "list": {
      const lines: string[] = []
      if (Array.isArray(rest.projects)) {
        for (const p of rest.projects) {
          lines.push(
            `PROJECT\t${sanitizePlainField(p.name)}\t${sanitizePlainField(p.artifactCount)}\t${sanitizePlainField(p.lastModifiedAt ?? "--")}`,
          )
        }
      }
      if (Array.isArray(rest.artifacts)) {
        for (const a of rest.artifacts) {
          lines.push(
            `ARTIFACT\t${sanitizePlainField(a.project)}\t${sanitizePlainField(a.slug)}\t${sanitizePlainField(a.title)}\t${sanitizePlainField(a.modifiedAt)}`,
          )
        }
      }
      return lines
    }
    case "doctor": {
      const checks = Array.isArray(rest.checks) ? rest.checks : []
      return checks.map((c: { check: unknown; ok: boolean; message?: unknown }) =>
        `${c.ok ? "PASS" : "FAIL"}\t${sanitizePlainField(c.check)}\t${sanitizePlainField(c.message ?? "--")}`,
      )
    }
    case "serve status": {
      const { running, url, tracked, pid } = rest
      return [`${running ? "RUNNING" : "STOPPED"}\t${sanitizePlainField(url)}\t${tracked ? "TRACKED" : "UNTRACKED"}\t${sanitizePlainField(pid ?? "--")}`]
    }
    case "serve stop": {
      const { stopped, method, url, pid } = rest as {
        stopped: boolean
        method: string
        url: unknown
        pid?: unknown
      }
      let status = "NOOP"
      if (stopped) status = "STOPPED"
      else if (method === "refused") status = "REFUSED"
      return [`${status}\t${sanitizePlainField(url)}\t${sanitizePlainField(method)}\t${sanitizePlainField(pid ?? "--")}`]
    }
    case "contract": {
      const lines: string[] = [`CONTRACT\t${sanitizePlainField(rest.version)}`]
      if (Array.isArray(rest.nodeTypes)) {
        for (const t of rest.nodeTypes) lines.push(`NODE\t${sanitizePlainField(t)}`)
      }
      if (rest.node) {
        const node = rest.node as { type?: unknown }
        lines.push(`NODE\t${sanitizePlainField(node.type)}`)
      }
      return lines
    }
    case "setup cloudflare": {
      const { profileName, baseUrl } = rest
      return [`PROFILE\t${sanitizePlainField(profileName)}\t${sanitizePlainField(baseUrl)}`]
    }
    case "migrate-store":
      return [
        `MIGRATED\t${sanitizePlainField(rest.migrated)}\t${sanitizePlainField(rest.deduplicated)}\t${sanitizePlainField(rest.target)}`,
      ]
    case "bootstrap": {
      if (rest.dryRun) {
        const checks = Array.isArray(rest.checks) ? rest.checks : []
        return checks.map((c: { ok: boolean; prerequisite: unknown; message?: unknown }) =>
          `${c.ok ? "PASS" : "FAIL"}\t${sanitizePlainField(c.prerequisite)}\t${sanitizePlainField(c.message ?? "--")}`,
        )
      }
      return [`INSTALLED\t${sanitizePlainField(rest.binaryPath)}`]
    }
    default:
      return []
  }
}

export function formatHumanResult(data: ResultData): string {
  const { command, ...rest } = data
  switch (command) {
    case "create": {
      if (rest.dryRun) {
        return `Spec is valid: ${rest.slug}`
      }
      const lines = [
        `Created visual artifact ${rest.slug} in project ${rest.projectName}`,
        `  bundle: ${rest.bundleDir}`,
        `  path:   ${rest.path}`,
        `  url:    ${rest.url}`,
      ]
      if (rest.published && (rest.published as { remoteUrl?: unknown }).remoteUrl) {
        lines.push(`  remote: ${(rest.published as { remoteUrl: unknown }).remoteUrl}`)
      }
      return lines.join("\n")
    }
    case "open":
      return `Opened ${rest.url}`
    case "serve":
      return `Visualizer server running at ${rest.url}`
    case "validate":
      return `Valid artifact: ${rest.slug}`
    case "list": {
      const lines: string[] = []
      if (Array.isArray(rest.projects)) {
        if (rest.projects.length === 0) return "No projects."
        for (const project of rest.projects) {
          lines.push(
            `Project: ${project.name} (${project.artifactCount} artifact${project.artifactCount === 1 ? "" : "s"})`,
          )
        }
      }
      if (Array.isArray(rest.artifacts)) {
        if (rest.artifacts.length === 0) return `No artifacts in project ${rest.project}.`
        for (const artifact of rest.artifacts) {
          lines.push(`  ${artifact.slug} — ${artifact.title}`)
        }
      }
      return lines.join("\n")
    }
    case "doctor": {
      const checks = Array.isArray(rest.checks) ? rest.checks : []
      const lines = checks.map(
        (c: { check: unknown; ok: boolean; message?: unknown }) =>
          `${c.ok ? "PASS" : "FAIL"}  ${c.check}${c.message ? ` — ${c.message}` : ""}`,
      )
      if (rest.ok === false) lines.push(`${checks.filter((c: { ok: boolean }) => !c.ok).length} check(s) failed`)
      return lines.join("\n")
    }
    case "serve status":
      return `${rest.running ? "Running" : "Stopped"} at ${rest.url}${rest.tracked ? ` (tracked pid ${rest.pid ?? "--"})` : " (untracked)"}`
    case "serve stop": {
      const method = rest.method as string
      if (method === "refused") return `Refused to stop server: ${rest.reason}`
      if (rest.stopped) return `Stopped visualizer server at ${rest.url} via ${method}`
      return (rest.reason as string | undefined) ?? `No running visualizer server at ${rest.url}`
    }
    case "setup cloudflare":
      return `Cloudflare profile "${rest.profileName}" ready at ${rest.baseUrl}`
    case "migrate-store":
      return `Artifact store ready at ${rest.target}: ${rest.migrated} migrated, ${rest.deduplicated} deduplicated`
    case "bootstrap": {
      if (rest.dryRun) {
        const checks = Array.isArray(rest.checks) ? rest.checks : []
        const lines = [
          ...checks.map(
            (c: { ok: boolean; prerequisite: unknown; message?: unknown }) =>
              `${c.ok ? "PASS" : "FAIL"}  ${c.prerequisite}${c.message ? ` — ${c.message}` : ""}`,
          ),
          "Plan:",
          ...(Array.isArray(rest.plan) ? rest.plan.map((p: unknown) => `  ${p}`) : []),
        ]
        return lines.join("\n")
      }
      return `visual-artifact installed: ${rest.binaryPath}`
    }
    default:
      return ""
  }
}
