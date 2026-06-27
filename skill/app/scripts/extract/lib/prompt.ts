import { promises as fs } from "node:fs"
import * as path from "node:path"

export type PromptVars = Record<string, string | string[] | number | boolean | undefined>

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function loadPromptTemplate(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8")
}

export function renderPromptTemplate(template: string, vars: PromptVars): string {
  let result = template

  for (const [key, rawValue] of Object.entries(vars)) {
    if (rawValue === undefined) continue
    const value = Array.isArray(rawValue) ? rawValue.join("\n") : String(rawValue)
    result = result.replace(new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g"), value)
  }

  // Leave unmatched placeholders visible so missing vars are obvious.
  return result
}

export async function loadAndRenderPrompt(
  promptPath: string,
  vars: PromptVars,
): Promise<string> {
  const template = await loadPromptTemplate(promptPath)
  return renderPromptTemplate(template, vars)
}

export function resolvePromptPath(stepDir: string, promptFileName = "prompt.md"): string {
  return path.join(stepDir, promptFileName)
}
