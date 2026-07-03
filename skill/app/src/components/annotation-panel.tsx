"use client"

import { Textarea } from "@/components/ui/textarea"
import { useAnnotationContext } from "@/components/annotation-provider"

export function AnnotationPanel() {
  const { isCommentMode, isLoading, error, doc, selectedNode, draftText, setDraftText, clearSelection } =
    useAnnotationContext()

  if (!isCommentMode && !error) return null

  return (
    <aside
      className="fixed right-4 top-24 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border bg-card/95 p-4 shadow-card backdrop-blur-sm"
      aria-label="Annotation panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg font-medium tracking-tight">Comments</h3>
        {isCommentMode && (
          <button
            onClick={clearSelection}
            className="text-xs text-muted-foreground hover:text-foreground"
            type="button"
          >
            Esc to close
          </button>
        )}
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-clay"></span>
          Loading comments...
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">Could not load comments.</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {!isLoading && !error && doc?.threads.length === 0 && !selectedNode && (
        <p className="text-sm text-muted-foreground">
          No comments yet. Select a node to add the first one.
        </p>
      )}

      {!isLoading && !error && doc && doc.threads.length > 0 && !selectedNode && (
        <p className="text-sm text-muted-foreground">
          {doc.threads.length} thread{doc.threads.length === 1 ? "" : "s"}. Select a node to comment.
        </p>
      )}

      {selectedNode && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Selected {selectedNode.nodeId ? `node ${selectedNode.nodeId}` : selectedNode.nodePath}
          </p>
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Start a comment..."
            className="min-h-24"
            aria-label="Comment draft"
          />
          <p className="text-xs text-muted-foreground">Press Esc to cancel.</p>
        </div>
      )}
    </aside>
  )
}
