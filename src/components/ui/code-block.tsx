"use client"

import { useEffect, useId, useState, useSyncExternalStore } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Highlighter } from "shiki"

export type CodeBlockProps = {
  code: string
  language?: string
  title?: string
  caption?: string
  className?: string
}

const LIGHT_THEME = "github-light"
const DARK_THEME = "github-dark"

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

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: [LIGHT_THEME, DARK_THEME],
        langs: COMMON_LANGUAGES,
      })
    )
  }
  return highlighterPromise
}

export function CodeBlock({
  code,
  language = "text",
  title,
  caption,
  className,
}: CodeBlockProps) {
  const [html, setHtml] = useState("")
  const [error, setError] = useState<string | null>(null)
  const isDark = useIsDark()
  const [copied, setCopied] = useState(false)
  const titleId = useId()

  useEffect(() => {
    let cancelled = false

    getHighlighter()
      .then((highlighter) => {
        const lang = normalizeLanguage(language, highlighter)
        const out = highlighter.codeToHtml(code, {
          lang,
          theme: isDark ? DARK_THEME : LIGHT_THEME,
        })

        if (!cancelled) {
          setHtml(out)
          setError(null)
        }
      })
      .catch((highlightError) => {
        if (!cancelled) {
          setError(
            highlightError instanceof Error
              ? highlightError.message
              : "Could not highlight code"
          )
          setHtml("")
        }
      })

    return () => {
      cancelled = true
    }
  }, [code, language, isDark])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  const displayLanguage = language ? language.toLowerCase() : undefined

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm",
        className
      )}
      aria-labelledby={title ? titleId : undefined}
    >
      {(title || displayLanguage) && (
        <figcaption
          id={titleId}
          className="flex items-center justify-between gap-3 border-b bg-muted px-4 py-2"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {title ?? "Snippet"}
          </span>
          <div className="flex items-center gap-2">
            {displayLanguage && (
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {displayLanguage}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={copyCode}
              aria-label={copied ? "Code copied" : "Copy code"}
            >
              {copied ? (
                <Check data-icon="inline-start" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
            </Button>
          </div>
        </figcaption>
      )}
      <div className="relative">
        {error ? (
          <pre className="overflow-x-auto bg-zinc-950 p-4 text-sm leading-6 text-red-400">
            <code>{code}</code>
          </pre>
        ) : html ? (
          <div
            className="overflow-x-auto text-sm leading-6 [&_code]:font-mono [&_pre]:m-0 [&_pre]:p-4 [&_pre]:font-mono"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="overflow-x-auto bg-muted p-4 text-sm leading-6 text-muted-foreground">
            <code>{code}</code>
          </pre>
        )}
      </div>
      {caption && (
        <p className="border-t bg-muted px-4 py-2 text-sm leading-6 text-muted-foreground">
          {caption}
        </p>
      )}
    </figure>
  )
}

function useIsDark() {
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
    () => false
  )
}

function normalizeLanguage(language: string, highlighter: Highlighter): string {
  const normalized = language.toLowerCase()

  if (highlighter.getLoadedLanguages().includes(normalized)) {
    return normalized
  }

  return "text"
}
