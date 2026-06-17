import Image from "next/image"

import { cn } from "@/lib/utils"

export type ArtifactImageProps = {
  src: string
  alt: string
  caption?: string
  aspect?: "auto" | "square" | "video" | "wide"
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
  className,
}: ArtifactImageProps) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm",
        className
      )}
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
            "h-full w-full",
            aspect === "auto" ? "object-contain" : "object-cover"
          )}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
        />
      </div>
      {caption && (
        <figcaption className="break-words border-t bg-muted px-4 py-2 text-sm leading-6 text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
