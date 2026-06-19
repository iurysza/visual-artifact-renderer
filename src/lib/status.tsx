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

export function toneSurfaceClass(
  tone: "accent" | "success" | "warning" | "danger" | "neutral" | "default" | undefined
) {
  return cn(
    tone === "accent" &&
      "bg-[color-mix(in_oklch,var(--clay),transparent_92%)] border-[color-mix(in_oklch,var(--clay),transparent_65%)]",
    tone === "warning" &&
      "bg-[color-mix(in_oklch,var(--clay),transparent_88%)] border-[color-mix(in_oklch,var(--clay),transparent_55%)]",
    tone === "success" &&
      "bg-[color-mix(in_oklch,var(--olive),transparent_92%)] border-[color-mix(in_oklch,var(--olive),transparent_65%)]",
    tone === "danger" &&
      "bg-[color-mix(in_oklch,var(--rust),transparent_92%)] border-[color-mix(in_oklch,var(--rust),transparent_65%)]"
  )
}

export function statusPanelClass(value: unknown) {
  const tone = statusTone(formatCell(value))

  return toneSurfaceClass(tone)
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
