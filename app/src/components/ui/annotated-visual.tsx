"use client"

import { useId, useState } from "react"

import { ArtifactImage } from "@/components/ui/artifact-image"
import { cn } from "@/lib/utils"

export type AnnotatedVisualMarker = {
  title: string
  description: string
  x: number
  y: number
}

export type AnnotatedVisualProps = {
  src: string
  alt: string
  caption?: string
  aspect?: "square" | "video" | "wide"
  markers: AnnotatedVisualMarker[]
}

export function AnnotatedVisual({
  src,
  alt,
  caption,
  aspect = "video",
  markers,
}: AnnotatedVisualProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const id = useId()

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(16rem,0.85fr)] lg:items-start">
      <ArtifactImage
        src={src}
        alt={alt}
        caption={caption}
        aspect={aspect}
        zoom={false}
        overlay={markers.map((marker, index) => {
          const detailId = `${id}-marker-${index}`
          const isSelected = selectedIndex === index

          return (
            <button
              key={`${marker.title}-${index}`}
              type="button"
              className={cn(
                "absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-foreground font-mono text-xs font-semibold text-background shadow-sm outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/60",
                isSelected && "scale-110 bg-primary text-primary-foreground ring-3 ring-background/80",
              )}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              aria-label={`Marker ${index + 1}: ${marker.title}`}
              aria-describedby={detailId}
              aria-pressed={isSelected}
              onClick={(event) => {
                event.stopPropagation()
                setSelectedIndex(index)
              }}
            >
              {index + 1}
            </button>
          )
        })}
      />

      <ol className="m-0 flex list-none flex-col border-y p-0">
        {markers.map((marker, index) => {
          const isSelected = selectedIndex === index

          return (
            <li key={`${marker.title}-${index}`} className="border-b last:border-b-0">
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/60",
                  isSelected && "bg-muted",
                )}
                aria-pressed={isSelected}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedIndex(index)
                }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold",
                    isSelected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span id={`${id}-marker-${index}`} className="min-w-0">
                  <span className="block break-words font-medium text-foreground">
                    {marker.title}
                  </span>
                  <span className="mt-1 block break-words text-sm leading-6 text-muted-foreground">
                    {marker.description}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
