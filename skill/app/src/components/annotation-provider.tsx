"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import { LOCAL_ANONYMOUS_AUTHOR } from "@agents/visual-artifact-annotations"

import {
  loadAnnotationDocument,
  postAnnotationMutations,
  resolveLocalAuthor,
} from "@/lib/artifacts/annotations"
import type {
  AnnotationAnchor,
  AnnotationAuthor,
  AnnotationDocument,
  AnnotationMessage,
  AnnotationMutations,
  AnnotationThread,
} from "@/lib/artifacts/annotations"
import {
  findAnchorElement,
  getThreadCount,
  getThreadsForNode,
  type NodeIdentity,
} from "@/components/annotation-helpers"

export type ThreadFilter = "all" | "open" | "resolved"

interface AnnotationContextValue {
  project: string
  slug: string
  doc: AnnotationDocument | null
  isLoading: boolean
  error: string | null
  isCommentMode: boolean
  isPickingNode: boolean
  hoveredNode: NodeIdentity | null
  setHoveredNode: (node: NodeIdentity | null) => void
  selectedNode: NodeIdentity | null
  setSelectedNode: (node: NodeIdentity | null) => void
  activeThreadId: string | null
  setActiveThreadId: (id: string | null) => void
  filter: ThreadFilter
  setFilter: (filter: ThreadFilter) => void
  draftText: string
  setDraftText: (text: string) => void
  clearSelection: () => void
  openComments: () => void
  closeComments: () => void
  startNodePick: () => void
  stopNodePick: () => void
  selectNodeForComment: (node: NodeIdentity) => void
  getThreadsForNode: (nodeId: string | undefined, nodePath: string) => AnnotationThread[]
  getThreadCount: (nodeId: string | undefined, nodePath: string) => number
  filteredThreads: AnnotationThread[]
  totalThreadCount: number
  openThreadCount: number
  resolvedThreadCount: number
  author: AnnotationAuthor | null
  isFallbackAuthor: boolean
  isSaving: boolean
  createThread: (anchor: AnnotationAnchor, body: string) => Promise<void>
  addReply: (threadId: string, body: string) => Promise<void>
  resolveThread: (threadId: string) => Promise<void>
  reopenThread: (threadId: string) => Promise<void>
  selectThread: (threadId: string) => void
  resetError: () => void
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
  const [isSaving, setIsSaving] = useState(false)
  const [isCommentMode, setIsCommentMode] = useState(false)
  const [isPickingNode, setIsPickingNode] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<NodeIdentity | null>(null)
  const [selectedNode, setSelectedNode] = useState<NodeIdentity | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ThreadFilter>("all")
  const [draftText, setDraftText] = useState("")
  const [author, setAuthor] = useState<AnnotationAuthor | null>(null)

  const isFallbackAuthor = Boolean(
    author &&
      author.name === LOCAL_ANONYMOUS_AUTHOR.name &&
      author.email === LOCAL_ANONYMOUS_AUTHOR.email,
  )

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

  useEffect(() => {
    let cancelled = false
    resolveLocalAuthor()
      .then((a) => {
        if (!cancelled) setAuthor(a)
      })
      .catch(() => {
        if (!cancelled) setAuthor(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedNode(null)
    setActiveThreadId(null)
    setDraftText("")
  }, [])

  const openComments = useCallback(() => {
    setIsCommentMode(true)
    setIsPickingNode(false)
    setActiveThreadId(null)
    setSelectedNode(null)
    setDraftText("")
  }, [])

  const closeComments = useCallback(() => {
    setIsCommentMode(false)
    setIsPickingNode(false)
    setActiveThreadId(null)
    setSelectedNode(null)
    setDraftText("")
    setError(null)
  }, [])

  const startNodePick = useCallback(() => {
    setIsCommentMode(true)
    setIsPickingNode(true)
    setActiveThreadId(null)
    setSelectedNode(null)
    setDraftText("")
  }, [])

  const stopNodePick = useCallback(() => {
    setIsPickingNode(false)
  }, [])

  const selectNodeForComment = useCallback(
    (node: NodeIdentity) => {
      setSelectedNode(node)
      setIsPickingNode(false)
      setDraftText("")
      const nodeThreads = doc ? getThreadsForNode(doc.threads, node.nodeId, node.nodePath) : []
      if (nodeThreads.length > 0) {
        setActiveThreadId(nodeThreads[0]!.id)
      } else {
        setActiveThreadId(null)
      }
      scrollToNode(node.nodeId, node.nodePath)
    },
    [doc],
  )

  const stateRef = useRef({
    draftText,
    selectedNode,
    activeThreadId,
    isPickingNode,
    isCommentMode,
    closeComments,
    clearSelection,
  })

  useEffect(() => {
    stateRef.current = {
      draftText,
      selectedNode,
      activeThreadId,
      isPickingNode,
      isCommentMode,
      closeComments,
      clearSelection,
    }
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      const {
        draftText,
        activeThreadId,
        selectedNode,
        isPickingNode,
        isCommentMode,
        closeComments,
        clearSelection,
      } = stateRef.current
      if (draftText) {
        setDraftText("")
      } else if (activeThreadId) {
        setActiveThreadId(null)
      } else if (selectedNode) {
        clearSelection()
      } else if (isPickingNode) {
        setIsPickingNode(false)
      } else if (isCommentMode) {
        closeComments()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const getThreadsForNodeBound = useCallback(
    (nodeId: string | undefined, nodePath: string) => {
      return doc ? getThreadsForNode(doc.threads, nodeId, nodePath) : []
    },
    [doc],
  )

  const getThreadCountBound = useCallback(
    (nodeId: string | undefined, nodePath: string) => {
      return doc ? getThreadCount(doc.threads, nodeId, nodePath) : 0
    },
    [doc],
  )

  const filteredThreads = useMemo(() => {
    if (!doc) return []
    if (filter === "all") return doc.threads
    return doc.threads.filter((thread) => thread.status === filter)
  }, [doc, filter])

  const totalThreadCount = doc?.threads.length ?? 0
  const openThreadCount = doc?.threads.filter((t) => t.status === "open").length ?? 0
  const resolvedThreadCount = doc?.threads.filter((t) => t.status === "resolved").length ?? 0

  const makeMessage = useCallback(
    (body: string): AnnotationMessage => {
      const now = new Date().toISOString()
      return {
        id: generateId(),
        author: author ?? LOCAL_ANONYMOUS_AUTHOR,
        body: body.trim(),
        createdAt: now,
        updatedAt: now,
      }
    },
    [author],
  )

  const withOptimisticMutation = useCallback(
    async (
      buildOptimisticDoc: (current: AnnotationDocument) => AnnotationDocument,
      mutations: AnnotationMutations,
    ) => {
      if (!doc) return
      const previousDoc = doc
      const optimisticDoc = buildOptimisticDoc(doc)
      setDoc(optimisticDoc)
      setIsSaving(true)
      setError(null)

      try {
        await postAnnotationMutations(project, slug, mutations)
      } catch (err) {
        setDoc(previousDoc)
        setError(err instanceof Error ? err.message : "Failed to save annotations")
      } finally {
        setIsSaving(false)
      }
    },
    [doc, project, slug],
  )

  const createThread = useCallback(
    async (anchor: AnnotationAnchor, body: string) => {
      const trimmed = body.trim()
      if (!trimmed) return

      const message = makeMessage(trimmed)
      const now = message.createdAt
      const thread: AnnotationThread = {
        id: generateId(),
        anchor,
        status: "open",
        createdAt: now,
        updatedAt: now,
        messages: [message],
      }

      await withOptimisticMutation(
        (current) => ({
          ...current,
          threads: [...current.threads, thread],
        }),
        [{ type: "createThread", thread }],
      )

      setActiveThreadId(thread.id)
      setDraftText("")
    },
    [makeMessage, withOptimisticMutation],
  )

  const addReply = useCallback(
    async (threadId: string, body: string) => {
      const trimmed = body.trim()
      if (!trimmed) return
      const message = makeMessage(trimmed)

      await withOptimisticMutation(
        (current) => ({
          ...current,
          threads: current.threads.map((thread) =>
            thread.id === threadId
              ? { ...thread, messages: [...thread.messages, message], updatedAt: message.createdAt }
              : thread,
          ),
        }),
        [{ type: "addMessage", threadId, message }],
      )
    },
    [makeMessage, withOptimisticMutation],
  )

  const resolveThread = useCallback(
    async (threadId: string) => {
      await withOptimisticMutation(
        (current) => ({
          ...current,
          threads: current.threads.map((thread) =>
            thread.id === threadId ? { ...thread, status: "resolved" } : thread,
          ),
        }),
        [{ type: "resolveThread", threadId }],
      )
    },
    [withOptimisticMutation],
  )

  const reopenThread = useCallback(
    async (threadId: string) => {
      await withOptimisticMutation(
        (current) => ({
          ...current,
          threads: current.threads.map((thread) =>
            thread.id === threadId ? { ...thread, status: "open" } : thread,
          ),
        }),
        [{ type: "reopenThread", threadId }],
      )
    },
    [withOptimisticMutation],
  )

  const selectThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId)
      const thread = doc?.threads.find((t) => t.id === threadId)
      if (!thread) return
      setSelectedNode({
        nodeId: thread.anchor.nodeId,
        nodePath: thread.anchor.nodePath,
        nodeType: thread.anchor.nodeType,
        textSnippet: thread.anchor.textSnippet,
      })
      scrollToNode(thread.anchor.nodeId, thread.anchor.nodePath)
    },
    [doc],
  )

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo<AnnotationContextValue>(
    () => ({
      project,
      slug,
      doc,
      isLoading,
      error,
      isCommentMode,
      isPickingNode,
      hoveredNode,
      setHoveredNode,
      selectedNode,
      setSelectedNode,
      activeThreadId,
      setActiveThreadId,
      filter,
      setFilter,
      draftText,
      setDraftText,
      clearSelection,
      openComments,
      closeComments,
      startNodePick,
      stopNodePick,
      selectNodeForComment,
      getThreadsForNode: getThreadsForNodeBound,
      getThreadCount: getThreadCountBound,
      filteredThreads,
      totalThreadCount,
      openThreadCount,
      resolvedThreadCount,
      author,
      isFallbackAuthor,
      isSaving,
      createThread,
      addReply,
      resolveThread,
      reopenThread,
      selectThread,
      resetError,
    }),
    [
      project,
      slug,
      doc,
      isLoading,
      error,
      isCommentMode,
      isPickingNode,
      hoveredNode,
      selectedNode,
      activeThreadId,
      filter,
      draftText,
      clearSelection,
      openComments,
      closeComments,
      startNodePick,
      stopNodePick,
      selectNodeForComment,
      getThreadsForNodeBound,
      getThreadCountBound,
      filteredThreads,
      totalThreadCount,
      openThreadCount,
      resolvedThreadCount,
      author,
      isFallbackAuthor,
      isSaving,
      createThread,
      addReply,
      resolveThread,
      reopenThread,
      selectThread,
      resetError,
    ],
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

export function useOptionalAnnotationContext(): AnnotationContextValue | null {
  return useContext(AnnotationContext)
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function scrollToNode(nodeId: string | undefined, nodePath: string): void {
  if (typeof document === "undefined") return
  const element = findAnchorElement(nodeId, nodePath)
  if (!element) return
  element.scrollIntoView({ behavior: "smooth", block: "center" })
}
