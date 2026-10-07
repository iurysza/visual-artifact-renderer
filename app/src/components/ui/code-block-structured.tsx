"use client"

// Structured code-block mode: one React row per line (gutter, diff mark, tokens,
// inline annotation callouts). Tokens come from Shiki's codeToTokens; no raw HTML.
import { Fragment, useEffect, useId, useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DARK_CODE_THEME,
  getCodeHighlighter,
  LIGHT_CODE_THEME,
  normalizeCodeLanguage,
  useIsDarkTheme,
} from "@/lib/code-highlighting"
import { cn } from "@/lib/utils"

export type CodeAnnotation = { line: number; title: string; body?: string; tone?: "info" | "warn" | "risk" | "ok" }

export type StructuredCodeBlockProps = {
  code: string
  language?: string
  title?: string
  caption?: string
  lineNumbers?: boolean
  startLine?: number
  highlight?: (number | string)[]
  annotations?: CodeAnnotation[]
  diff?: boolean
  sketch?: boolean
  src?: string
}

type Token = { content: string; color?: string; fontStyle?: number }
type DiffKind = "add" | "del" | "hunk" | "ctx"

const TONE_CLASS: Record<NonNullable<CodeAnnotation["tone"]>, string> = {
  info: "border-l-[color:var(--chart-2,var(--clay))] bg-muted",
  warn: "border-l-change-changed bg-change-changed/10",
  risk: "border-l-change-removed bg-change-removed/10",
  ok: "border-l-change-added bg-change-added/10",
}
const TONE_PIN: Record<NonNullable<CodeAnnotation["tone"]>, string> = {
  info: "bg-foreground text-background",
  warn: "bg-change-changed text-background",
  risk: "bg-change-removed text-background",
  ok: "bg-change-added text-background",
}

export function splitCodeLines(code: string): string[] {
  return code.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n")
}

export function expandHighlight(highlight: readonly (number | string)[] | undefined): Set<number> {
  const out = new Set<number>()
  for (const entry of highlight ?? []) {
    if (typeof entry === "number") out.add(entry)
    else {
      const [a, b] = entry.split("-").map(Number)
      for (let n = a; n <= b; n++) out.add(n)
    }
  }
  return out
}

function diffKind(line: string): DiffKind {
  if (line.startsWith("@@")) return "hunk"
  if (line.startsWith("+")) return "add"
  if (line.startsWith("-")) return "del"
  return "ctx"
}

export function StructuredCodeBlock(props: StructuredCodeBlockProps) {
  const { code, language = "text", title, caption, startLine = 1, annotations = [], diff, sketch, src } = props
  const showNumbers = props.lineNumbers ?? true
  const isDark = useIsDarkTheme()
  const titleId = useId()
  const lines = useMemo(() => splitCodeLines(code), [code])
  const kinds = useMemo(() => (diff ? lines.map(diffKind) : null), [diff, lines])
  // Diff lines are highlighted without their 2-char prefix.
  const bodies = useMemo(() => (kinds ? lines.map((line, i) => (kinds[i] === "hunk" ? line : line.slice(2))) : lines), [kinds, lines])
  const [tokens, setTokens] = useState<{ key: string; lines: Token[][] } | null>(null)
  const tokenKey = `${language}\u0000${isDark}\u0000${bodies.join("\n")}`
  const [closed, setClosed] = useState<Set<number>>(() => new Set())
  const [copied, setCopied] = useState(false)
  const highlighted = useMemo(() => expandHighlight(props.highlight), [props.highlight])
  const byLine = useMemo(() => {
    const map = new Map<number, { annotation: CodeAnnotation; n: number }>()
    ;[...annotations].sort((a, b) => a.line - b.line).forEach((annotation, index) => map.set(annotation.line, { annotation, n: index + 1 }))
    return map
  }, [annotations])

  useEffect(() => {
    let cancelled = false
    getCodeHighlighter()
      .then((highlighter) => {
        const lang = normalizeCodeLanguage(language, highlighter)
        const result = highlighter.codeToTokens(bodies.join("\n"), { lang, theme: isDark ? DARK_CODE_THEME : LIGHT_CODE_THEME })
        if (!cancelled) setTokens({ key: tokenKey, lines: result.tokens as Token[][] })
      })
      .catch(() => {
        if (!cancelled) setTokens(null)
      })
    return () => {
      cancelled = true
    }
  }, [bodies, isDark, language, tokenKey])

  const lineTokens = tokens?.key === tokenKey ? tokens.lines : null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diff ? bodies.filter((_, i) => kinds?.[i] !== "del" && kinds?.[i] !== "hunk").join("\n") : code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  const toggle = (line: number) =>
    setClosed((previous) => {
      const next = new Set(previous)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })

  const headerName = title ?? src ?? "Snippet"
  let lineNumber = startLine - 1

  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby={titleId} data-code-mode="structured">
      <figcaption id={titleId} className="flex items-center justify-between gap-3 border-b bg-muted px-4 py-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-mono text-xs text-foreground">
          <span className="break-all font-semibold">{headerName}</span>
          {sketch && (
            <span className="rounded border border-dashed border-muted-foreground/50 px-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground" title="Illustrative, not real code yet">
              sketch
            </span>
          )}
          {diff && <span className="rounded bg-background px-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">diff</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{language.toLowerCase()}</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label={copied ? "Code copied" : "Copy code"}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          </Button>
        </span>
      </figcaption>
      <div className="overflow-x-auto" tabIndex={0} aria-label={`${headerName} code`} role="region">
        <div className="min-w-max py-2 font-mono text-[13px] leading-6">
          {lines.map((raw, index) => {
            const kind = kinds?.[index] ?? "ctx"
            const isHunk = kind === "hunk"
            if (!isHunk && kind !== "del") lineNumber++
            const current = kind === "del" ? undefined : lineNumber
            const shownNumber = isHunk ? "" : kind === "del" ? "" : String(current)
            const note = current !== undefined && !isHunk ? byLine.get(current) : undefined
            const isHi = current !== undefined && highlighted.has(current)
            const toks = lineTokens?.[index]
            return (
              <Fragment key={index}>
                <div
                  data-line={current ?? ""}
                  data-diff={kinds ? kind : undefined}
                  data-highlighted={isHi ? "true" : undefined}
                  className={cn(
                    "flex",
                    kind === "add" && "bg-change-added/12",
                    kind === "del" && "bg-change-removed/12",
                    isHi && "bg-accent/40 shadow-[inset_2px_0_0_var(--clay)]",
                  )}
                >
                  {(showNumbers || kinds) && (
                    <span className="sticky left-0 flex shrink-0 select-none bg-inherit">
                      {showNumbers && (
                        <span className="w-11 bg-card pr-3 text-right text-muted-foreground/70" aria-hidden="true">
                          {shownNumber}
                        </span>
                      )}
                      {kinds && (
                        <span
                          className={cn(
                            "w-5 bg-card text-center",
                            kind === "add" && "text-change-added",
                            kind === "del" && "text-change-removed",
                          )}
                          aria-label={kind === "add" ? "added" : kind === "del" ? "removed" : undefined}
                        >
                          {kind === "add" ? "+" : kind === "del" ? "−" : ""}
                        </span>
                      )}
                    </span>
                  )}
                  <code className={cn("whitespace-pre pr-4", isHunk && "text-muted-foreground", !showNumbers && !kinds && "pl-4")}>
                    {isHunk
                      ? raw
                      : toks
                        ? toks.map((token, t) => (
                            <span key={t} style={{ color: token.color, fontStyle: token.fontStyle && token.fontStyle & 1 ? "italic" : undefined }}>
                              {token.content}
                            </span>
                          ))
                        : bodies[index] || " "}
                  </code>
                  {note && (
                    <button
                      type="button"
                      onClick={() => toggle(note.annotation.line)}
                      aria-expanded={!closed.has(note.annotation.line)}
                      aria-label={`Note ${note.n}: ${note.annotation.title}`}
                      className={cn(
                        "sticky right-2 ml-auto mr-2 mt-1 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                        TONE_PIN[note.annotation.tone ?? "info"],
                      )}
                    >
                      {note.n}
                    </button>
                  )}
                </div>
                {note && !closed.has(note.annotation.line) && (
                  <div className="sticky left-0 w-[min(100%,40rem)] px-3 py-1 font-sans" data-annotation-line={note.annotation.line} style={{ maxWidth: "calc(100vw - 4rem)" }}>
                    <div className={cn("rounded-md border border-l-[3px] px-3 py-1.5 text-sm leading-5", TONE_CLASS[note.annotation.tone ?? "info"])}>
                      <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{note.n}</span>
                      <span className="font-medium text-foreground">{note.annotation.title}</span>
                      {note.annotation.body && <p className="mt-0.5 text-muted-foreground">{note.annotation.body}</p>}
                    </div>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
      {caption && <p className="break-words border-t bg-muted px-4 py-2 text-sm leading-6 text-muted-foreground">{caption}</p>}
    </figure>
  )
}
