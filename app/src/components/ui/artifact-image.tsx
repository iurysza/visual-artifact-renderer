"use client"

import { useState } from "react"
import Image from "next/image"
import { Maximize2Icon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type ArtifactImageProps = {
  src: string
  alt: string
  caption?: string
  aspect?: "auto" | "square" | "video" | "wide"
  zoom?: boolean
  className?: string
}

const aspectClass = {
  auto: "",
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[21/9]",
}

export function ArtifactImage({
  src,
  alt,
  caption,
  aspect = "auto",
  zoom = true,
  className,
}: ArtifactImageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const zoomable = zoom !== false

  return (
    <>
      <figure
        className={cn(
          "group overflow-hidden rounded-2xl border bg-card shadow-sm",
          zoomable && "cursor-zoom-in",
          className
        )}
        onClick={zoomable ? () => setIsOpen(true) : undefined}
      >
        <div
          className={cn(
            "relative w-full",
            aspectClass[aspect],
            aspect === "auto" && "min-h-[12rem]"
          )}
        >
          <Image
            src={src}
            alt={alt}
            fill
            className={cn(
              "h-full w-full transition-transform duration-300",
              aspect === "auto" ? "object-contain" : "object-cover",
              zoomable && "group-hover:scale-[1.02]"
            )}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
          />
          {zoomable && (
            <div className="pointer-events-none absolute right-3 top-3 rounded-full border bg-background/80 p-1.5 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <Maximize2Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        {caption && (
          <figcaption className="break-words px-4 py-2 text-sm leading-6 text-muted-foreground">
            {caption}
          </figcaption>
        )}
      </figure>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="gap-0 overflow-hidden rounded-2xl border-none bg-transparent p-0 shadow-none"
          style={{
            width: "min(calc(100vw - 1rem), 80rem)",
            maxWidth: "calc(100vw - 1rem)",
            height: "calc(100dvh - 1rem)",
            maxHeight: "calc(100dvh - 1rem)",
          }}
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{alt}</DialogTitle>
          </DialogHeader>
          <div className="relative flex h-full min-h-0 flex-col gap-3">
            <div className="absolute right-2 top-2 z-10">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Close image preview"
                onClick={() => setIsOpen(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative flex-1 overflow-hidden rounded-2xl bg-black/5">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
            {caption && (
              <figcaption className="break-words px-1 py-2 text-sm leading-6 text-muted-foreground">
                {caption}
              </figcaption>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
