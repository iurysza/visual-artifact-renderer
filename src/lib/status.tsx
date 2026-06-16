import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatCell } from "@/lib/data"

export function statusTone(value: string) {
  const normalized = value.toLowerCase()

  if (
    [
      "pass",
      "passed",
      "ok",
      "healthy",
      "linked",
      "running",
      "configured",
      "done",
      "yes",
      "success",
      "guarded",
      "checked",
      "loaded",
      "shared",
      "attached",
      "rendered",
      "manifested",
      "enforced",
    ].some((word) => normalized.includes(word))
  ) {
    return "success"
  }

  if (
    ["warn", "warning", "risk", "attention", "partial", "degraded", "drift", "medium"].some(
      (word) => normalized.includes(word)
    )
  ) {
    return "warning"
  }

  if (
    ["fail", "failed", "error", "blocked", "danger", "critical", "high", "leak", "down"].some(
      (word) => normalized.includes(word)
    )
  ) {
    return "danger"
  }

  if (
    ["info", "pending", "next", "review", "neutral", "optional", "preview", "check"].some(
      (word) => normalized.includes(word)
    )
  ) {
    return "accent"
  }

  return "neutral"
}

export function statusBadgeVariant(tone: ReturnType<typeof statusTone>) {
  if (tone === "danger") return "destructive"
  if (tone === "neutral") return "outline"
  if (tone === "success") return "default"

  return "secondary"
}

export function statusPanelClass(value: unknown) {
  const tone = statusTone(formatCell(value))

  return cn(
    tone === "success" && "border-l-4 border-l-[var(--olive)]",
    tone === "warning" && "border-l-4 border-l-[var(--clay)]",
    tone === "danger" && "border-l-4 border-l-[var(--rust)]",
    tone === "accent" && "border-l-4 border-l-[var(--clay)]"
  )
}

export function statusIsVisible(value: unknown, description?: unknown) {
  if (value === undefined) return false

  const statusStr = formatCell(value)
  const descStr = description !== undefined ? formatCell(description) : ""

  return (
    statusStr.length > 0 &&
    statusStr.length <= 16 &&
    statusStr.toLowerCase() !== descStr.toLowerCase()
  )
}

export function StatusChip({ value, className }: { value: unknown; className?: string }) {
  const text = formatCell(value)
  const tone = statusTone(text)

  return (
    <Badge variant={statusBadgeVariant(tone)} className={cn("justify-start", className)}>
      {text}
    </Badge>
  )
}
