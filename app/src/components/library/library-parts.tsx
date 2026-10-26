"use client"

import { useEffect, useId, useRef, useState, type RefObject } from "react"
import Link from "next/link"
import { format, formatDistanceToNowStrict } from "date-fns"
import { SearchIcon, XIcon } from "lucide-react"

import type { ArtifactType } from "@/lib/contract/artifact-schema"
import { artifactPagePath } from "@/lib/artifacts/paths"
import { isNew, type LibraryRow } from "@/lib/artifacts/library"
import { activeToken, operatorToken, queryOperators, withoutOperator, type QueryOperator } from "@/lib/artifacts/library-query"
import { applySuggestion, type QualifierSuggestion } from "@/lib/artifacts/library-suggest"

export type LoadState<T> =
  | { status: "loading" }
  | { status: "loaded"; data: T }
  | { status: "failed"; error: string }

/** Fetch JSON once, then again whenever the tab becomes visible. */
export function useLiveJson<T>(url: string | null): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" })
  useEffect(() => {
    if (!url) return
    let cancelled = false
    async function load(target: string) {
      try {
        const response = await fetch(target)
        if (!response.ok) throw new Error(`Index not found (${response.status})`)
        const data = (await response.json()) as T
        if (!cancelled) setState({ status: "loaded", data })
      } catch (error) {
        if (!cancelled) setState((prev) => prev.status === "loaded" ? prev : { status: "failed", error: error instanceof Error ? error.message : String(error) })
      }
    }
    void load(url)
    const onVisible = () => { if (document.visibilityState === "visible") void load(url) }
    document.addEventListener("visibilitychange", onVisible)
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible) }
  }, [url])
  return state
}

/** Stable "now" per mount so relative labels do not drift during a render pass. */
export function useNow(): number {
  const [now] = useState(() => Date.now())
  return now
}

/** `/` focuses search from anywhere outside a text field; Escape clears then blurs. */
export function useSlashFocus(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      event.preventDefault()
      ref.current?.focus()
      ref.current?.select()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ref])
}

export function typeLabel(type?: ArtifactType): string {
  if (!type) return "Artifact"
  return type === "comparison" ? "Compare" : type[0].toUpperCase() + type.slice(1)
}

export function shortDate(iso: string, now: number): string {
  const date = new Date(iso)
  return date.getFullYear() === new Date(now).getFullYear() ? format(date, "d MMM") : format(date, "d MMM yy")
}

export function relativeDate(iso: string, now: number): string {
  const ms = now - Date.parse(iso)
  if (ms < 60_000) return "just now"
  if (ms < 7 * 86_400_000) return `${formatDistanceToNowStrict(new Date(iso))} ago`
  return shortDate(iso, now)
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  inputRef: RefObject<HTMLInputElement | null>
  /** Qualifiers that cannot be removed here, such as the page's own project. */
  locked?: QueryOperator[]
  label: string
  /** Qualifier completions for the token under the caret. Omit to disable the menu. */
  suggest?: (raw: string, cursor: number) => QualifierSuggestion[]
}

/** Search input with removable qualifier chips and a completion menu. */
export function SearchBox({ value, onChange, placeholder, inputRef, locked = [], label, suggest }: SearchBoxProps) {
  const ops = queryOperators(value)
  const listId = useId().replace(/:/g, "")
  const [cursor, setCursor] = useState(0)
  const [focused, setFocused] = useState(false)
  const [closedFor, setClosedFor] = useState<string | null>(null)
  const token = activeToken(value, cursor)
  const atEnd = cursor === token.end
  const suggestions = atEnd ? suggest?.(value, cursor) ?? [] : []
  const open = focused && suggestions.length > 0 && closedFor !== token.text
  const [active, setActive] = useState(0)
  const signature = suggestions.map((item) => item.insert).join("\0")
  const [signatureSeen, setSignatureSeen] = useState(signature)
  if (signature !== signatureSeen) {
    setSignatureSeen(signature)
    setActive(0)
  }
  const activeIndex = suggestions.length === 0 ? 0 : Math.min(active, suggestions.length - 1)
  const optionId = (index: number) => `${listId}-opt-${index}`
  const pendingCaret = useRef<number | null>(null)

  useEffect(() => {
    const caret = pendingCaret.current
    if (caret === null) return
    pendingCaret.current = null
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(caret, caret)
    setCursor(caret)
  }, [value, inputRef])

  useEffect(() => {
    if (!open) return
    document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" })
  }, [open, activeIndex, listId])

  function syncCursor(target: HTMLInputElement) {
    setCursor(target.selectionStart ?? target.value.length)
  }

  function accept(suggestion: QualifierSuggestion) {
    const next = applySuggestion(value, cursor, suggestion)
    pendingCaret.current = next.cursor
    onChange(next.value)
    setCursor(next.cursor)
    setClosedFor(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <label className="lib-search">
          <SearchIcon aria-hidden className="size-4 shrink-0 text-ink-muted" />
          {locked.map((op) => <span key={operatorToken(op)} className="lib-chip">{operatorToken(op)}</span>)}
          <span className="sr-only">{label}</span>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            value={value}
            spellCheck={false}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open ? optionId(activeIndex) : undefined}
            aria-haspopup="listbox"
            placeholder={placeholder}
            onFocus={(event) => { setFocused(true); syncCursor(event.currentTarget) }}
            onBlur={() => setFocused(false)}
            onSelect={(event) => syncCursor(event.currentTarget)}
            onKeyUp={(event) => syncCursor(event.currentTarget)}
            onClick={(event) => syncCursor(event.currentTarget)}
            onChange={(event) => { onChange(event.target.value); syncCursor(event.target) }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                if (suggestions.length === 0) return
                event.preventDefault()
                setClosedFor(null)
                if (!open) {
                  setActive(event.key === "ArrowUp" ? suggestions.length - 1 : 0)
                  return
                }
                const delta = event.key === "ArrowDown" ? 1 : -1
                setActive(Math.max(0, Math.min(suggestions.length - 1, activeIndex + delta)))
                return
              }
              if ((event.key === "Enter" || event.key === "Tab") && open) {
                event.preventDefault()
                const suggestion = suggestions[activeIndex]
                if (suggestion) accept(suggestion)
                return
              }
              if (event.key !== "Escape") return
              if (open) { event.preventDefault(); setClosedFor(token.text); return }
              if (value) { event.preventDefault(); onChange("") } else event.currentTarget.blur()
            }}
          />
          <span className="lib-kbd hidden sm:inline" aria-hidden>/</span>
        </label>
        {open && (
          <ul id={listId} role="listbox" aria-label="Search suggestions" className="lib-suggest">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.insert}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => accept(suggestion)}
              >
                <span>{suggestion.label}</span>
                {suggestion.hint && <span className="hint lib-num">{suggestion.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {ops.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Active filters">
          {ops.map((op) => (
            <span key={operatorToken(op)} className="lib-chip">
              {operatorToken(op)}
              <button type="button" aria-label={`Remove ${operatorToken(op)}`} onClick={() => onChange(withoutOperator(value, op))}>
                <XIcon className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function FoldSummary({ row }: { row: LibraryRow }) {
  const versions = row.folded.filter((f) => f.kind === "version")
  const copies = row.folded.filter((f) => f.kind === "copy")
  const places = [...new Set(copies.map((f) => f.label))]
  return (
    <span>
      {versions.length > 0 && <><b>{versions.map((f) => f.label).join(", ")}</b> folded</>}
      {versions.length > 0 && copies.length > 0 && " · "}
      {copies.length > 0 && <><b>{plural(copies.length, "copy", "copies")}</b> in {places.join(", ")}</>}
    </span>
  )
}

export function CatalogueRow({ row, now, href, showProject = true }: { row: LibraryRow; now: number; href: (project: string, slug: string) => string; showProject?: boolean }) {
  const [open, setOpen] = useState(false)
  const foldId = `fold-${row.key.replace(/[^a-z0-9-]/g, "-")}`
  const a = row.artifact
  const firstLink = useRef<HTMLAnchorElement>(null)
  return (
    <div className="lib-item">
      <Link href={href(a.project, a.slug)} className={showProject ? "lib-row" : "lib-row lib-row-solo"} data-library-row>
        <span className="lib-label">
          {typeLabel(a.artifactType)}
          {isNew(a, now) && <span className="lib-new"> · new</span>}
        </span>
        <div className="min-w-0">
          <div className="lib-title">{a.title || a.slug}</div>
          {a.description && <div className="lib-desc">{a.description}</div>}
          <div className="lib-extra">
            {row.openThreads > 0 && (
              <span className="s inline-flex items-baseline gap-1.5">
                <span className="lib-dot" aria-hidden />
                {row.openThreads} open{a.openExcerpt ? ` · “${a.openExcerpt}”` : ""}
              </span>
            )}
            {row.version && <span className="s">{row.version} · latest of {row.folded.length + 1}</span>}
            {a.topics && a.topics.length > 0 && <span>{a.topics.slice(0, 3).join(" · ")}</span>}
            {a.published && <span>Published</span>}
            {!showProject && <span className="lib-num min-[861px]:hidden">{shortDate(a.modifiedAt, now)}</span>}
            {showProject && <span className="min-[861px]:hidden">{a.project} · {shortDate(a.modifiedAt, now)}</span>}
          </div>
        </div>
        {showProject && <span className="lib-proj">{a.project}</span>}
        <span className="lib-when lib-num">{shortDate(a.modifiedAt, now)}</span>
      </Link>
      {row.folded.length > 0 && (
        <div className="lib-fold">
          <button
            type="button"
            className="lib-fold-toggle"
            aria-expanded={open}
            aria-controls={foldId}
            onClick={() => { setOpen((v) => !v); if (!open) requestAnimationFrame(() => firstLink.current?.focus({ preventScroll: true })) }}
          >
            <span className="chev" aria-hidden>▸</span>
            <FoldSummary row={row} />
          </button>
          {open && (
            <div id={foldId} className="lib-fold-list">
              {row.folded.map((f, i) => (
                <Link key={`${f.artifact.project}/${f.artifact.slug}`} ref={i === 0 ? firstLink : undefined} href={href(f.artifact.project, f.artifact.slug)} className="lib-link-row">
                  <span className="lib-label w-24 shrink-0">{f.kind === "version" ? f.label : "Copy"}</span>
                  <span className="t min-w-0 truncate">{f.artifact.title || f.artifact.slug}</span>
                  <span className="ml-auto hidden shrink-0 text-ink-muted sm:inline">{f.artifact.project}/{f.artifact.slug}</span>
                  <span className="lib-num shrink-0 text-ink-muted">{shortDate(f.artifact.modifiedAt, now)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function artifactHref(search: string) {
  return (project: string, slug: string) => `${artifactPagePath(project, slug)}${search}`
}
