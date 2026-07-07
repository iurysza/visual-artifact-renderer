"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

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
import { usePanelParams } from "@/components/panel-params"
import {
  getThreadCount,
  getThreadsForNode,
  scrollToNode,
  type NodeIdentity,
} from "./annotation-helpers"

export type ThreadFilter = "all" | "open" | "resolved"
export type PanelView = "list" | "node" | "thread"

/**
 * Author resolution state.
 *
 * `loading` — initial fetch in flight, `author` is the local fallback.
 * `ready` — git identity resolved, `author` is the real identity.
 * `fallback` — fetch failed or git identity unset; `author` is the local
 *   fallback so posting is still possible, but the UI should label it as a
 *   local author rather than a real git identity.
 */
export type AuthorStatus = "loading" | "ready" | "fallback"

interface AnnotationContextValue {
  project: string
  slug: string
  doc: AnnotationDocument | null
  isLoading: boolean
  error: string | null
  isCommentMode: boolean
  isPickingNode: boolean
  pickCandidateNode: NodeIdentity | null
  setPickCandidateNode: (node: NodeIdentity | null) => void
  confirmNodePick: () => void
  hoveredNode: NodeIdentity | null
  setHoveredNode: (node: NodeIdentity | null) => void
  selectedNode: NodeIdentity | null
  setSelectedNode: (node: NodeIdentity | null) => void
  highlightedNode: NodeIdentity | null
  setHighlightedNode: (node: NodeIdentity | null) => void
  previewNode: NodeIdentity | null
  setPreviewNode: (node: NodeIdentity | null) => void
  activeThreadId: string | null
  setActiveThreadId: (id: string | null) => void
  panelView: PanelView
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
  author: AnnotationAuthor
  authorStatus: AuthorStatus
  isFallbackAuthor: boolean
  isSaving: boolean
  createThread: (anchor: AnnotationAnchor, body: string) => Promise<void>
  addReply: (threadId: string, body: string) => Promise<void>
  deleteMessage: (threadId: string, messageId: string) => Promise<void>
  editMessage: (threadId: string, messageId: string, body: string) => Promise<void>
  resolveThread: (threadId: string) => Promise<void>
  reopenThread: (threadId: string) => Promise<void>
  selectThread: (threadId: string) => void
  goBack: () => void
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
  const [params, setParams] = usePanelParams()

  const [doc, setDoc] = useState<AnnotationDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // UI-only state (not in the URL): pick candidate, hover, highlight, preview
  // identity, draft composer text, and the filter sort.
  const [pickCandidateNode, setPickCandidateNode] = useState<NodeIdentity | null>(null)
  const [hoveredNode, setHoveredNode] = useState<NodeIdentity | null>(null)
  // Full node identity captured at click/pick time. The public `selectedNode`
  // (derived below) mirrors the `node` URL param and reuses this when the
  // path matches, so deep links get a minimal identity without losing the
  // real one in the normal flow.
  const [selectedNodeState, setSelectedNode] = useState<NodeIdentity | null>(null)
  // Highlight anchor set on forward navigation into a thread; derived
  // `highlightedNode` vanishes automatically when the thread param is gone.
  const [highlightAnchor, setHighlightAnchor] = useState<NodeIdentity | null>(null)
  const [previewNode, setPreviewNode] = useState<NodeIdentity | null>(null)
  const [filter, setFilter] = useState<ThreadFilter>("all")
  const [draftText, setDraftText] = useState("")
  // Start with the local fallback so `author` is never null and posting can
  // never race the fetch. `authorStatus` makes the loading/ready/fallback
  // distinction explicit; the composer uses it to disable Post while loading
  // and to label fallback correctly.
  const [author, setAuthor] = useState<AnnotationAuthor>(LOCAL_ANONYMOUS_AUTHOR)
  const [authorStatus, setAuthorStatus] = useState<AuthorStatus>("loading")

  // --- Panel state is derived from the URL -------------------------------
  // `panel` selects which side panel is open; `thread`/`node` deepen the
  // comments panel; `pick` enters node-picking. Forward transitions push a
  // history entry, so the hardware back button walks the panel automatically.
  const isCommentMode = params.panel === "comments"
  const isPickingNode = isCommentMode && params.pick === "1"
  const activeThreadId = params.thread
  const panelView: PanelView = params.thread ? "thread" : params.node ? "node" : "list"
  const isFallbackAuthor = authorStatus === "fallback"
  const setHighlightedNode = setHighlightAnchor

  // selectedNode / highlightedNode are derived from the URL so back navigation
  // clears them without setState-in-effect: the browser owns the stack.
  const selectedNode = useMemo<NodeIdentity | null>(() => {
    if (!params.node) return null
    if (selectedNodeState && selectedNodeState.nodePath === params.node) return selectedNodeState
    return { nodePath: params.node }
  }, [params.node, selectedNodeState])

  const highlightedNode = useMemo<NodeIdentity | null>(
    () => (params.thread ? highlightAnchor : null),
    [params.thread, highlightAnchor],
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
        if (cancelled) return
        const isFallback =
          a.name === LOCAL_ANONYMOUS_AUTHOR.name && a.email === LOCAL_ANONYMOUS_AUTHOR.email
        setAuthor(a)
        setAuthorStatus(isFallback ? "fallback" : "ready")
      })
      .catch(() => {
        if (cancelled) return
        setAuthor(LOCAL_ANONYMOUS_AUTHOR)
        setAuthorStatus("fallback")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openComments = useCallback(() => {
    setParams(
      { panel: "comments", thread: null, node: null, pick: null },
      { history: "push" },
    )
    setPickCandidateNode(null)
    setError(null)
  }, [setParams])

  const closeComments = useCallback(() => {
    // Collapse in place (replace) so we never leave the site even on a deep
    // link with no history below. HW back is unaffected; only this explicit
    // toggle action uses replace.
    setParams(
      { panel: null, thread: null, node: null, pick: null },
      { history: "replace" },
    )
    setPickCandidateNode(null)
    setError(null)
  }, [setParams])

  const startNodePick = useCallback(() => {
    // Push a pick entry so back stops picking. Keep `node` so picking from
    // the composer's "Change component" returns to the composer on back.
    setParams({ panel: "comments", pick: "1", thread: null }, { history: "push" })
    setPickCandidateNode(null)
  }, [setParams])

  const stopNodePick = useCallback(() => {
    // Replace — strip `pick` from the current entry.
    setParams({ pick: null }, { history: "replace" })
    setPickCandidateNode(null)
  }, [setParams])

  const selectNodeForComment = useCallback(
    (node: NodeIdentity) => {
      // Set full identity first so the sync effect keeps it (path matches).
      setSelectedNode(node)
      setPickCandidateNode(null)
      setDraftText("")
      setHighlightedNode(null)
      setPreviewNode(null)
      // Consume the pick entry (replace) so back from the composer returns to
      // the list rather than re-entering picking.
      setParams(
        { node: node.nodePath, thread: null, pick: null },
        { history: "replace" },
      )
      scrollToNode(node.nodeId, node.nodePath)
    },
    [setParams, setHighlightedNode],
  )

  const confirmNodePick = useCallback(() => {
    if (!pickCandidateNode) return
    selectNodeForComment(pickCandidateNode)
  }, [pickCandidateNode, selectNodeForComment])

  const clearSelection = useCallback(() => {
    setParams({ thread: null, node: null, pick: null }, { history: "replace" })
    setHighlightedNode(null)
    setPreviewNode(null)
    setDraftText("")
  }, [setParams, setHighlightedNode])

  const setActiveThreadId = useCallback(
    (id: string | null) => {
      setParams({ thread: id }, { history: id ? "push" : "replace" })
    },
    [setParams],
  )

  const goBack = useCallback(() => {
    // The browser owns the stack; UI back / Escape just pops one entry, which
    // is exactly what hardware back does.
    window.history.back()
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
        author,
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

      // Open the new thread over the current node composer. Keeping `node`
      // means hardware back returns to the composer (returnView=node),
      // matching the prior behavior.
      setHighlightAnchor({
        nodeId: anchor.nodeId,
        nodePath: anchor.nodePath,
        nodeType: anchor.nodeType,
        textSnippet: anchor.textSnippet,
      })
      setParams({ thread: thread.id }, { history: "push" })
      setDraftText("")
    },
    [makeMessage, withOptimisticMutation, setParams, setHighlightAnchor],
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

  const deleteMessage = useCallback(
    async (threadId: string, messageId: string) => {
      await withOptimisticMutation(
        (current) => ({
          ...current,
          threads: current.threads
            .map((thread) => {
              if (thread.id !== threadId) return thread
              const messages = thread.messages.filter((m) => m.id !== messageId)
              if (messages.length === 0) return null
              return { ...thread, messages, updatedAt: new Date().toISOString() }
            })
            .filter((thread): thread is AnnotationThread => thread !== null),
        }),
        [{ type: "deleteMessage", threadId, messageId }],
      )
    },
    [withOptimisticMutation],
  )

  const editMessage = useCallback(
    async (threadId: string, messageId: string, body: string) => {
      const trimmed = body.trim()
      if (!trimmed) return
      const updatedAt = new Date().toISOString()

      await withOptimisticMutation(
        (current) => ({
          ...current,
          threads: current.threads.map((thread) => {
            if (thread.id !== threadId) return thread
            const messages = thread.messages.map((m) =>
              m.id === messageId ? { ...m, body: trimmed, updatedAt } : m,
            )
            return { ...thread, messages, updatedAt }
          }),
        }),
        [{ type: "editMessage", threadId, messageId, body: trimmed, updatedAt }],
      )
    },
    [withOptimisticMutation],
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
      const thread = doc?.threads.find((t) => t.id === threadId)
      if (!thread) return

      setHighlightAnchor({
        nodeId: thread.anchor.nodeId,
        nodePath: thread.anchor.nodePath,
        nodeType: thread.anchor.nodeType,
        textSnippet: thread.anchor.textSnippet,
      })
      scrollToNode(thread.anchor.nodeId, thread.anchor.nodePath)
      // Keeping `node` (if set) means back from a thread opened from the node
      // composer returns to the composer; from the list, `node` is already
      // null so back returns to the list.
      setParams({ thread: threadId }, { history: "push" })
    },
    [doc, setParams, setHighlightAnchor],
  )

  // Escape: clear draft first, then let the browser walk back one entry.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (!isCommentMode) return
      event.preventDefault()
      if (draftText) {
        setDraftText("")
      } else {
        window.history.back()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isCommentMode, draftText])

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
      pickCandidateNode,
      setPickCandidateNode,
      confirmNodePick,
      hoveredNode,
      setHoveredNode,
      selectedNode,
      setSelectedNode,
      highlightedNode,
      setHighlightedNode,
      previewNode,
      setPreviewNode,
      activeThreadId,
      setActiveThreadId,
      panelView,
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
      authorStatus,
      isFallbackAuthor,
      isSaving,
      createThread,
      addReply,
      deleteMessage,
      editMessage,
      resolveThread,
      reopenThread,
      selectThread,
      goBack,
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
      pickCandidateNode,
      confirmNodePick,
      hoveredNode,
      selectedNode,
      highlightedNode,
      previewNode,
      activeThreadId,
      panelView,
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
      authorStatus,
      isFallbackAuthor,
      isSaving,
      createThread,
      addReply,
      deleteMessage,
      editMessage,
      resolveThread,
      reopenThread,
      selectThread,
      setActiveThreadId,
      goBack,
      resetError,
      setHighlightedNode,
      setSelectedNode,
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