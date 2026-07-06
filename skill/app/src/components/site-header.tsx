"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, MessageSquare, Bot } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useOptionalAnnotationContext } from "@/components/annotations"
import { useOptionalAIColabContext } from "@/components/ai-colab/ai-colab-provider"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const BASE_PATH = "/artifacts"

function humanize(slug: string) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function SiteHeader() {
  const pathname = usePathname()
  const annotationCtx = useOptionalAnnotationContext()
  const aiColabCtx = useOptionalAIColabContext()
  const routePath = pathname?.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || "/"
    : pathname || "/"

  const segments = routePath.split("/").filter(Boolean)

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
          <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
            <BreadcrumbItem className="shrink-0">
              {segments.length === 0 ? (
                <BreadcrumbPage className="flex min-w-0 items-center gap-1.5">
                  <Home data-icon="inline-start" className="shrink-0" />
                  <span className="sr-only sm:not-sr-only">Home</span>
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href="/" />} className="flex min-w-0 items-center gap-1.5">
                  <Home data-icon="inline-start" className="shrink-0" />
                  <span className="sr-only sm:not-sr-only">Home</span>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>

            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1
              const isIntermediate = !isLast
              const href = "/" + segments.slice(0, index + 1).join("/") + "/"
              const label = humanize(segment)

              return (
                <React.Fragment key={`${segment}-${index}`}>
                  <BreadcrumbSeparator className={cn("shrink-0", isIntermediate && "hidden sm:flex")} />
                  <BreadcrumbItem
                    className={cn(
                      "min-w-0",
                      isIntermediate && "hidden sm:inline-flex",
                      isLast && "flex-1 overflow-hidden"
                    )}
                  >
                    {isLast ? (
                      <BreadcrumbPage className="block max-w-full truncate">{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={href} />} className="block truncate">
                        {label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {annotationCtx && (
            <ToggleGroup
              multiple={false}
              variant="outline"
              size="sm"
              spacing={0}
              value={
                annotationCtx.isCommentMode
                  ? ["comments"]
                  : aiColabCtx?.isAIColabMode
                    ? ["colab"]
                    : undefined
              }
              onValueChange={(values: string[]) => {
                const v = values[0]
                if (v === "comments") {
                  aiColabCtx?.closeAIColab()
                  annotationCtx.openComments()
                } else if (v === "colab") {
                  annotationCtx.closeComments()
                  aiColabCtx?.openAIColab()
                } else {
                  if (annotationCtx.isCommentMode) annotationCtx.closeComments()
                  if (aiColabCtx?.isAIColabMode) aiColabCtx.closeAIColab()
                }
              }}
              aria-label="Annotation mode"
            >
              <ToggleGroupItem value="comments">
                <MessageSquare data-icon="inline-start" />
                <span className="hidden sm:inline">Comments</span>
                {annotationCtx.totalThreadCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-medium">
                    {annotationCtx.totalThreadCount}
                  </span>
                )}
              </ToggleGroupItem>

              <ToggleGroupItem value="colab">
                <Bot data-icon="inline-start" />
                <span className="hidden sm:inline">Colab</span>
                {aiColabCtx && aiColabCtx.comments.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-medium">
                    {aiColabCtx.comments.length}
                  </span>
                )}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <ThemeToggle className="shrink-0" />
        </div>
      </div>
    </header>
  )
}
