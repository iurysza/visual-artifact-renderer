"use client"

import { AlertTriangle, ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"

function BackButton({
  onClick,
  label,
}: {
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={label}
      title={label}
    >
      <ArrowLeft className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

interface DetailPanelHeaderProps {
  title: string
  count?: number
  snippet: string
  nodeType: string
  isPresent: boolean
  onBack: () => void
  backLabel?: string
  desktopActions?: React.ReactNode
  mobileActions?: React.ReactNode
}

export function DetailPanelHeader({
  title,
  count,
  snippet,
  nodeType,
  isPresent,
  onBack,
  backLabel = "Back",
  desktopActions,
  mobileActions,
}: DetailPanelHeaderProps) {
  return (
    <>
      {/* Desktop header */}
      <div className="hidden md:flex flex-col gap-2 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BackButton onClick={onBack} label={backLabel} />
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-medium tracking-tight">
                {title}
              </h3>
              {typeof count === "number" && (
                <Badge variant="secondary">{count}</Badge>
              )}
            </div>
          </div>
          {desktopActions && (
            <div className="flex shrink-0 items-center gap-2">
              {desktopActions}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{snippet}</span>
          <span>{nodeType}</span>
          {!isPresent && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
              title="Anchor not found"
            >
              <AlertTriangle className="size-3" />
            </span>
          )}
        </div>
      </div>

      {/* Mobile header */}
      <div className="flex md:hidden items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BackButton onClick={onBack} label="Back" />
          <h3 className="font-serif text-base font-medium tracking-tight">
            {title}
          </h3>
          {typeof count === "number" && (
            <Badge variant="secondary">{count}</Badge>
          )}
        </div>
        {mobileActions && (
          <div className="flex items-center gap-2">{mobileActions}</div>
        )}
      </div>
    </>
  )
}