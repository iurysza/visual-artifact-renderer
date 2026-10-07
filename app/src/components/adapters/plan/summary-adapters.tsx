"use client"

import { FileText, GitPullRequest, Hash, Mail, MessageSquare, Mic, ScrollText, Terminal, type LucideIcon } from "lucide-react"

import type { AdapterArgs } from "@/components/artifact-types"
import { cn } from "@/lib/utils"

export function renderChangeStats({ node }: AdapterArgs<"change-stats">) {
  const { label, added, changed, removed, files, lines } = node.props
  const total = files ?? added + changed + removed
  const chip = "inline-flex items-center rounded-md border px-2 py-0.5"
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-xs" data-change-stats>
      {label && <span className={cn(chip, "border-transparent bg-foreground text-background")}>{label}</span>}
      <span className={cn(chip, "text-foreground")} aria-label={`${total} files`}>{total} files</span>
      <span className={cn(chip, "text-change-added")} aria-label={`${added} new files`}>+{added} new</span>
      <span className={cn(chip, "text-change-changed")} aria-label={`${changed} changed files`}>~{changed} changed</span>
      <span className={cn(chip, "text-change-removed")} aria-label={`${removed} deleted files`}>−{removed} deleted</span>
      {lines && (
        <span className={cn(chip, "text-muted-foreground")} aria-label={`${lines.add} lines added, ${lines.del} lines deleted`}>
          <span className="text-change-added">+{lines.add}</span>&nbsp;<span className="text-change-removed">−{lines.del}</span>&nbsp;lines
        </span>
      )}
    </div>
  )
}

const VIA_ICON: Record<string, LucideIcon> = {
  prompt: Terminal,
  slack: Hash,
  github: GitPullRequest,
  doc: FileText,
  email: Mail,
  meeting: Mic,
  transcript: ScrollText,
}

export function renderQuotes({ node }: AdapterArgs<"quotes">) {
  const { title, open, items } = node.props
  const vias = [...new Set(items.map((item) => item.via))]
  const summary = title ?? `Why · ${items.length} ${items.length === 1 ? "request" : "requests"}`
  return (
    <details open={open} className="group rounded-xl border bg-card" data-quotes>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
        <span className="flex-1">{summary}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground" aria-hidden="true">
          {vias.map((via) => {
            const Icon = VIA_ICON[via] ?? MessageSquare
            return <Icon key={via} className="size-3.5" />
          })}
        </span>
      </summary>
      <div className="space-y-4 border-t px-4 py-4">
        {items.map((item, index) => {
          const Icon = VIA_ICON[item.via] ?? MessageSquare
          return (
            <figure key={index} className="space-y-1.5">
              <blockquote className="border-l-2 border-muted-foreground/30 pl-4 font-serif text-lg leading-7 text-foreground">“{item.text}”</blockquote>
              <figcaption className="flex flex-wrap items-center gap-1.5 pl-4 text-xs text-muted-foreground">
                <Icon className="size-3.5" aria-hidden="true" />
                <span>—</span>
                {item.from && <span className="font-medium text-foreground/80">{item.from}</span>}
                <span>· via {item.via}</span>
                {item.date && <time dateTime={item.date}>· {item.date}</time>}
                {item.href && (
                  <a href={item.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    · source
                  </a>
                )}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </details>
  )
}
