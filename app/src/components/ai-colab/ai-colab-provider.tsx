"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import type { VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import type { AIColabComment } from "@/lib/ai-colab/types"
import {
  addComment as addCommentHelper,
  buildArtifactTarget,
  buildNodeTarget,
  copyAIColabMarkdown,
} from "@/lib/ai-colab/ai-colab-store"
import { artifactDataPath } from "@/lib/artifacts/paths"
import { scrollToNode, type NodeIdentity } from "@/components/annotations"
import { usePanelParams } from "@/components/panel-params"
import type { AIColabPanelView } from "./types"

interface AIColabContextValue {
  isAIColabMode: boolean
  isPickingNode: boolean
  pickCandidateNode: NodeIdentity | null
  selectedNode: NodeIdentity | null
  hoveredNode: NodeIdentity | null
  draftText: string
  comments: AIColabComment[]
  panelView: AIColabPanelView
  copied: boolean
  copyError: string | null
  spec: VisualArtifactSpec | null
  openAIColab: () => void
  closeAIColab: () => void
  startNodePick: () => void
  stopNodePick: () => void
  selectNode: (node: NodeIdentity) => void
  setPickCandidateNode: (node: NodeIdentity | null) => void
  confirmNodePick: () => void
  setDraftText: (text: string) => void
  addComment: (body: string) => void
  addArtifactComment: (body: string) => void
  deleteComment: (id: string) => void
  setSpec: (spec: VisualArtifactSpec | null) => void
  setHoveredNode: (node: NodeIdentity | null) => void
  goToList: () => void
  copyToClipboard: () => Promise<void>
}

const AIColabContext = createContext<AIColabContextValue | null>(null)

export function AIColabProvider({
  children,
  project,
  slug,
}: {
  children: React.ReactNode
  project?: string
  slug?: string
}) {
  return (
    <AIColabProviderInner project={project} slug={slug}>
      {children}
    </AIColabProviderInner>
  )
}

function AIColabProviderInner({
  children,
  project,
  slug,
}: {
  children: React.ReactNode
  project?: string
  slug?: string
}) {
  const [params, setParams] = usePanelParams()

  const [pickCandidateNode, setPickCandidateNode] = useState<NodeIdentity | null>(null)
  const [hoveredNode, setHoveredNode] = useState<NodeIdentity | null>(null)
  // Full node identity captured at pick time. The public `selectedNode` is
  // derived from the `node` URL param and reuses this when the path matches,
  // so deep links get a minimal identity without losing the real one.
  const [selectedNodeState, setSelectedNode] = useState<NodeIdentity | null>(null)
  const [draftText, setDraftText] = useState("")
  const [comments, setComments] = useState<AIColabComment[]>([])
  const [spec, setSpec] = useState<VisualArtifactSpec | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)

  // --- Panel state is derived from the URL -----------------------------
  const isAIColabMode = params.panel === "colab"
  const isPickingNode = isAIColabMode && params.pick === "1"
  const panelView: AIColabPanelView = params.node ? "node" : "list"

  const selectedNode = useMemo<NodeIdentity | null>(() => {
    if (!params.node) return null
    if (selectedNodeState && selectedNodeState.nodePath === params.node) return selectedNodeState
    return { nodePath: params.node }
  }, [params.node, selectedNodeState])

  const clearTransientState = useCallback(() => {
    setPickCandidateNode(null)
    setHoveredNode(null)
    setDraftText("")
    setCopyError(null)
  }, [])

  const openAIColab = useCallback(() => {
    const isDesktop =
      typeof window !== "undefined" &&
      !window.matchMedia("(pointer:coarse)").matches &&
      window.matchMedia("(min-width: 768px)").matches
    setParams(
      { panel: "colab", thread: null, node: null, pick: isDesktop ? null : "1" },
      { history: "push" },
    )
    clearTransientState()
  }, [setParams, clearTransientState])

  const closeAIColab = useCallback(() => {
    setParams(
      { panel: null, thread: null, node: null, pick: null },
      { history: "replace" },
    )
    clearTransientState()
    setSelectedNode(null)
  }, [setParams, clearTransientState])

  const startNodePick = useCallback(() => {
    // Push a pick entry so back stops picking. Keep `node` so picking from
    // the composer's "Change component" returns to the composer on back.
    setParams({ panel: "colab", pick: "1", thread: null }, { history: "push" })
    setPickCandidateNode(null)
  }, [setParams])

  const stopNodePick = useCallback(() => {
    setParams({ pick: null }, { history: "replace" })
    setPickCandidateNode(null)
  }, [setParams])

  const goToList = useCallback(() => {
    // The browser owns the stack; UI back just pops one entry.
    window.history.back()
  }, [])

  const selectNode = useCallback(
    (node: NodeIdentity) => {
      setSelectedNode(node)
      setPickCandidateNode(null)
      setHoveredNode(null)
      setDraftText("")
      // Consume the pick entry (replace) so back from the composer returns to
      // the list rather than re-entering picking.
      setParams({ node: node.nodePath, thread: null, pick: null }, { history: "replace" })
      scrollToNode(node.nodeId, node.nodePath)
    },
    [setParams],
  )

  const confirmNodePick = useCallback(() => {
    if (!pickCandidateNode) return
    selectNode(pickCandidateNode)
  }, [pickCandidateNode, selectNode])

  const addComment = useCallback(
    (body: string) => {
      const target = selectedNode ? buildNodeTarget(selectedNode) : buildArtifactTarget()
      const nextComments = addCommentHelper(comments, body, target)
      if (nextComments === comments) return
      setComments(nextComments)
      setDraftText("")
      // After posting a node comment, return to the list by replacing the URL.
      setParams({ node: null, thread: null, pick: null }, { history: "replace" })
      setSelectedNode(null)
    },
    [comments, selectedNode, setParams],
  )

  const addArtifactComment = useCallback(
    (body: string) => {
      const nextComments = addCommentHelper(comments, body, buildArtifactTarget())
      if (nextComments === comments) return
      setComments(nextComments)
      setDraftText("")
    },
    [comments],
  )

  const deleteComment = useCallback((id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const copyToClipboard = useCallback(async () => {
    if (!spec || !project || !slug) return
    setCopyError(null)
    try {
      const filePath = artifactDataPath(project, slug)
      await copyAIColabMarkdown({ spec, comments, filePath })
      setCopied(true)
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Could not copy Markdown")
    }
  }, [spec, comments, project, slug])

  // Clear in-memory comments when the artifact identity changes so comments from
  // one artifact do not leak into another. Identity is project + slug; fall back to
  // slug only when route props are not available (e.g. tests or optional mounts).
  const lastArtifactKeyRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!spec) return
    const key = project && slug ? `${project}/${slug}` : spec.slug
    if (key === lastArtifactKeyRef.current) return
    lastArtifactKeyRef.current = key
    setComments([])
    setSelectedNode(null)
    setDraftText("")
    setPickCandidateNode(null)
    setHoveredNode(null)
    if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
    // Close the panel via the URL without pushing a new history entry.
    setParams({ panel: null, thread: null, node: null, pick: null }, { history: "replace" })
  }, [spec, project, slug, setParams])

  // Progressive Escape handling: clear draft, then stop picking, then pop one
  // history entry (node composer -> list, or list -> closed).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (!isAIColabMode) return
      event.preventDefault()
      if (draftText) {
        setDraftText("")
      } else if (isPickingNode) {
        stopNodePick()
      } else if (params.node) {
        window.history.back()
      } else {
        closeAIColab()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAIColabMode, isPickingNode, params.node, draftText, closeAIColab, stopNodePick])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const value = useMemo<AIColabContextValue>(
    () => ({
      isAIColabMode,
      isPickingNode,
      pickCandidateNode,
      selectedNode,
      hoveredNode,
      draftText,
      comments,
      panelView,
      copied,
      copyError,
      spec,
      openAIColab,
      closeAIColab,
      startNodePick,
      stopNodePick,
      selectNode,
      setPickCandidateNode,
      confirmNodePick,
      setDraftText,
      addComment,
      addArtifactComment,
      deleteComment,
      setSpec,
      setHoveredNode,
      goToList,
      copyToClipboard,
    }),
    [
      isAIColabMode,
      isPickingNode,
      pickCandidateNode,
      selectedNode,
      hoveredNode,
      draftText,
      comments,
      panelView,
      copied,
      copyError,
      spec,
      openAIColab,
      closeAIColab,
      startNodePick,
      stopNodePick,
      selectNode,
      confirmNodePick,
      addComment,
      addArtifactComment,
      deleteComment,
      goToList,
      copyToClipboard,
    ],
  )

  return <AIColabContext.Provider value={value}>{children}</AIColabContext.Provider>
}

export function useAIColabContext(): AIColabContextValue {
  const ctx = useContext(AIColabContext)
  if (!ctx) {
    throw new Error("useAIColabContext must be used within an AIColabProvider")
  }
  return ctx
}

export function useOptionalAIColabContext(): AIColabContextValue | null {
  return useContext(AIColabContext)
}
