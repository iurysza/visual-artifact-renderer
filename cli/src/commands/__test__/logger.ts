export interface CapturingLogger {
  error: (m: string) => void
  warn: (m: string) => void
  log: (m: string) => void
  info: (m: string) => void
  debug: (m: string) => void
  success: (m: string) => void
  output: (o: unknown) => void
  outputText: (t: string) => void
  result: (o: unknown) => void
  resultText: (t: string) => void
  rawDiagnostic: (t: string) => void
  structured: () => boolean
  _logs: string[]
}

export function makeLogger(): CapturingLogger {
  const logs: string[] = []
  return {
    error: (m: string) => logs.push(`error: ${m}`),
    warn: (m: string) => logs.push(`warn: ${m}`),
    log: (m: string) => logs.push(`log: ${m}`),
    info: (m: string) => logs.push(`info: ${m}`),
    debug: (m: string) => logs.push(`debug: ${m}`),
    success: (m: string) => logs.push(`success: ${m}`),
    output: (o: unknown) => logs.push(`output: ${JSON.stringify(o)}`),
    outputText: (t: string) => logs.push(`text: ${t}`),
    result: (o: unknown) => logs.push(`output: ${JSON.stringify(o)}`),
    resultText: (t: string) => logs.push(`text: ${t}`),
    rawDiagnostic: (t: string) => logs.push(`raw: ${t}`),
    structured: () => false,
    _logs: logs,
  }
}
