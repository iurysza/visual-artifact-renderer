import type { GlobalOpts } from "./types.ts"

export class Logger {
  private opts: GlobalOpts
  private isTTY: boolean

  constructor(opts: GlobalOpts) {
    this.opts = opts
    this.isTTY = process.stdout.isTTY ?? false
  }

  private color(code: string, text: string): string {
    if (this.opts.noColor || !this.isTTY) return text
    return `\x1b[${code}m${text}\x1b[0m`
  }

  log(message: string): void {
    if (this.opts.quiet) return
    console.log(message)
  }

  info(message: string): void {
    if (this.opts.quiet) return
    console.error(this.color("34", `info: ${message}`))
  }

  warn(message: string): void {
    if (this.opts.quiet) return
    console.error(this.color("33", `warn: ${message}`))
  }

  error(message: string): void {
    console.error(this.color("31", `error: ${message}`))
  }

  success(message: string): void {
    if (this.opts.quiet) return
    console.log(this.color("32", message))
  }

  output(data: unknown): void {
    if (this.opts.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }
    if (this.opts.plain) {
      console.log(JSON.stringify(data))
      return
    }
    console.log(data)
  }

  outputText(text: string): void {
    if (this.opts.quiet) return
    console.log(text)
  }
}

export function isQuiet(): boolean {
  return process.env.VISUAL_ARTIFACT_QUIET === "1"
}
