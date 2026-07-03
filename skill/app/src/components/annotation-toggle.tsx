"use client"

import { MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAnnotationContext } from "@/components/annotation-provider"

export function AnnotationToggle() {
  const { isCommentMode, toggleCommentMode, totalThreadCount } = useAnnotationContext()

  return (
    <Button
      variant={isCommentMode ? "default" : "outline"}
      size="sm"
      onClick={toggleCommentMode}
      aria-pressed={isCommentMode}
      aria-label={isCommentMode ? "Exit comment mode" : "Enter comment mode"}
    >
      <MessageSquare data-icon="inline-start" />
      {isCommentMode ? "Comments on" : "Comments"}
      {totalThreadCount > 0 && (
        <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0 text-[10px] font-medium">
          {totalThreadCount}
        </span>
      )}
    </Button>
  )
}
