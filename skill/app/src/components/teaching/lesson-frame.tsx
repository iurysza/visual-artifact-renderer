"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { SourceLink } from "./types"

export interface LessonFrameProps {
  number: number
  total: number
  title: string
  description?: string
  source?: SourceLink
  prevHref?: string
  nextHref?: string
  nextRep?: string
  children: ReactNode
  className?: string
}

export function LessonFrame({
  number,
  total,
  title,
  description,
  source,
  prevHref,
  nextHref,
  nextRep,
  children,
  className,
}: LessonFrameProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="secondary">
            Lesson {number} of {total}
          </Badge>
          {source && (
            <a
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <BookOpen className="size-3.5" />
              {source.label}
            </a>
          )}
        </div>
        <CardTitle className="font-serif text-2xl tracking-tight">
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
      <Separator />
      <CardFooter className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {prevHref ? (
            <Link
              href={prevHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" })
              )}
            >
              <ArrowLeft className="size-4" />
              Previous
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ArrowLeft className="size-4" />
              Previous
            </Button>
          )}
          {nextHref ? (
            <Link
              href={nextHref}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Next
              <ArrowRight className="size-4" />
            </Link>
          ) : (
            <Button size="sm" disabled>
              Next
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
        {nextRep && (
          <p className="text-sm text-muted-foreground">
            Next rep:{" "}
            <span className="font-medium text-foreground">{nextRep}</span>
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
