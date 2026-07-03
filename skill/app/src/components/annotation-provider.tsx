"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import { loadAnnotationDocument } from "@/lib/artifacts/annotations"
import type { AnnotationDocument, AnnotationThread } from "@/lib/artifacts/annotations"
import { getThreadCount, getThreadsForNode, type NodeIdentity } from "@/components/annotation-helpers"

interface AnnotationContextValue {
  doc: AnnotationDocument | null
  isLoading: boolean
  error: string | null
  isCommentMode: boolean
  toggleCommentMode: () => void
  setIsCommentMode: (value: boolean) => void
  hoveredNode: NodeIdentity | null
  setHoveredNode: (node: NodeIdentity | null) => void
  selectedNode: NodeIdentity | null
  setSelectedNode: (node: NodeIdentity | null) => void
  activeThreadId: string | null
  setActiveThreadId: (id: string | null) => void
  draftText: string
  setDraftText: (text: string) => void
  clearSelection: () => void
  getThreadsForNode: (nodeId: string | undefined, nodePath: string) => AnnotationThread[]
  getThreadCount: (nodeId: string | undefined, nodePath: string) => number
  totalThreadCount: number
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null)

export function AnnotationProvider({
  project,
  slug,
  children,
}: {
  project: string
  slug: string
  children: React.ReactNode
}) {
  // Remount the inner provider when the artifact identity changes so the
  // loading state is naturally reset without synchronously calling setState
  // inside an effect.
  return (
    <AnnotationProviderInner key={`${project}:${slug}`} project={project} slug={slug}>
      {children}
    </AnnotationProviderInner>
  )
}

function AnnotationProviderInner({
  project,
  slug,
  children,
}: {
  project: string
  slug: string
  children: React.ReactNode
}) {
  const [doc, setDoc] = useState<AnnotationDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCommentMode, setIsCommentMode] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<NodeIdentity | null>(null)
  const [selectedNode, setSelectedNode] = useState<NodeIdentity | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState("")

  useEffect(() => {
    let cancelled = false
    loadAnnotationDocument(project, slug)
      .then((data) => {
        if (!cancelled) setDoc(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load annotations")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [project, slug])

  const clearSelection = useCallback(() => {
    setSelectedNode(null)
    setActiveThreadId(null)
    setDraftText("")
  }, [])

  const toggleCommentMode = useCallback(() => {
    setIsCommentMode((prev) => {
      if (prev) clearSelection()
      return !prev
    })
  }, [clearSelection])

  const setIsCommentModeWrapped = useCallback(
    (value: boolean) => {
      setIsCommentMode(value)
      if (!value) clearSelection()
    },
    [clearSelection]
  )

  // Keep the latest state values in a ref so the keyboard listener can read
  // them without re-registering on every render or synchronously setting state
  // inside the effect body.
  const stateRef = useRef({
    draftText,
    selectedNode,
    isCommentMode,
    clearSelection,
  })

  useEffect(() => {
    stateRef.current = { draftText, selectedNode, isCommentMode, clearSelection }
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      const { draftText, selectedNode, isCommentMode, clearSelection } = stateRef.current
      if (draftText) {
        setDraftText("")
      } else if (selectedNode) {
        clearSelection()
      } else if (isCommentMode) {
        setIsCommentMode(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const getThreadsForNodeBound = useCallback(
    (nodeId: string | undefined, nodePath: string) => {
      return doc ? getThreadsForNode(doc.threads, nodeId, nodePath) : []
    },
    [doc]
  )

  const getThreadCountBound = useCallback(
    (nodeId: string | undefined, nodePath: string) => {
      return doc ? getThreadCount(doc.threads, nodeId, nodePath) : 0
    },
    [doc]
  )

  const totalThreadCount = doc?.threads.length ?? 0

  const value = useMemo<AnnotationContextValue>(
    () => ({
      doc,
      isLoading,
      error,
      isCommentMode,
      toggleCommentMode,
      setIsCommentMode: setIsCommentModeWrapped,
      hoveredNode,
      setHoveredNode,
      selectedNode,
      setSelectedNode,
      activeThreadId,
      setActiveThreadId,
      draftText,
      setDraftText,
      clearSelection,
      getThreadsForNode: getThreadsForNodeBound,
      getThreadCount: getThreadCountBound,
      totalThreadCount,
    }),
    [
      doc,
      isLoading,
      error,
      isCommentMode,
      toggleCommentMode,
      setIsCommentModeWrapped,
      hoveredNode,
      selectedNode,
      activeThreadId,
      draftText,
      clearSelection,
      getThreadsForNodeBound,
      getThreadCountBound,
      totalThreadCount,
    ]
  )

  return <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>
}

export function useAnnotationContext(): AnnotationContextValue {
  const ctx = useContext(AnnotationContext)
  if (!ctx) {
    throw new Error("useAnnotationContext must be used within an AnnotationProvider")
  }
  return ctx
}
