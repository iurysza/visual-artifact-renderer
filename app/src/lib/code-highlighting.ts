"use client"

import { useSyncExternalStore } from "react"
import type { BundledLanguage, Highlighter, SpecialLanguage } from "shiki"

export const LIGHT_CODE_THEME = "github-light"
export const DARK_CODE_THEME = "github-dark"

const COMMON_LANGUAGES = [
  "bash",
  "shell",
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "python",
  "yaml",
  "yml",
  "json",
  "html",
  "css",
  "sql",
  "markdown",
  "md",
  "rust",
  "go",
  "graphql",
  "text",
  "plaintext",
]

let highlighterPromise: Promise<Highlighter> | null = null

export function getCodeHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: [LIGHT_CODE_THEME, DARK_CODE_THEME],
        langs: COMMON_LANGUAGES,
      })
    )
  }
  return highlighterPromise
}

export function normalizeCodeLanguage(
  language: string,
  highlighter: Highlighter,
): BundledLanguage | SpecialLanguage {
  const normalized = language.toLowerCase()
  return highlighter.getLoadedLanguages().includes(normalized)
    ? normalized as BundledLanguage
    : "text"
}

export function useIsDarkTheme() {
  return useSyncExternalStore(
    (callback) => {
      const observer = new MutationObserver(callback)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      })
      return () => observer.disconnect()
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  )
}
