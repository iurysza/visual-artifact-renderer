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
  copyToClipboard: () => Promise<void>
  setPanelView: (view: AIColabPanelView) => void
  goToList: () => void
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
  const [isAIColabMode, setIsAIColabMode] = useState(false)
  const [isPickingNode, setIsPickingNode] = useState(false)
  const [pickCandidateNode, setPickCandidateNode] = useState<NodeIdentity | null>(null)
  const [selectedNode, setSelectedNode] = useState<NodeIdentity | null>(null)
  const [hoveredNode, setHoveredNode] = useState<NodeIdentity | null>(null)
  const [draftText, setDraftText] = useState("")
  const [comments, setComments] = useState<AIColabComment[]>([])
  const [panelView, setPanelView] = useState<AIColabPanelView>("list")
  const [spec, setSpec] = useState<VisualArtifactSpec | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)

  const clearTransientState = useCallback(() => {
    setPickCandidateNode(null)
    setSelectedNode(null)
    setHoveredNode(null)
    setDraftText("")
    setPanelView("list")
    setCopyError(null)
  }, [])

  const openAIColab = useCallback(() => {
    setIsAIColabMode(true)
    const isDesktop =
      typeof window !== "undefined" &&
      !window.matchMedia("(pointer:coarse)").matches &&
      window.matchMedia("(min-width: 768px)").matches
    setIsPickingNode(!isDesktop)
    clearTransientState()
  }, [clearTransientState])

  const closeAIColab = useCallback(() => {
    setIsAIColabMode(false)
    setIsPickingNode(false)
    clearTransientState()
  }, [clearTransientState])

  const startNodePick = useCallback(() => {
    setIsAIColabMode(true)
    setIsPickingNode(true)
    setPickCandidateNode(null)
    setSelectedNode(null)
    setHoveredNode(null)
    setDraftText("")
    setPanelView("list")
  }, [])

  const stopNodePick = useCallback(() => {
    setIsPickingNode(false)
    setPickCandidateNode(null)
  }, [])

  const goToList = useCallback(() => {
    setSelectedNode(null)
    setHoveredNode(null)
    setDraftText("")
    setPanelView("list")
  }, [])

  const selectNode = useCallback((node: NodeIdentity) => {
    setSelectedNode(node)
    setIsPickingNode(false)
    setPickCandidateNode(null)
    setHoveredNode(null)
    setDraftText("")
    setPanelView("node")
    scrollToNode(node.nodeId, node.nodePath)
  }, [])

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
      setPanelView("list")
    },
    [comments, selectedNode]
  )

  const addArtifactComment = useCallback(
    (body: string) => {
      const nextComments = addCommentHelper(comments, body, buildArtifactTarget())
      if (nextComments === comments) return
      setComments(nextComments)
      setDraftText("")
    },
    [comments]
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
    setPanelView("list")
    setIsAIColabMode(false)
    setIsPickingNode(false)
    if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
  }, [spec, project, slug])

  // Progressive Escape handling: clear draft, then stop picking, then close node
  // composer, then close the mode.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (!isAIColabMode) return
      event.preventDefault()
      if (draftText) {
        setDraftText("")
      } else if (isPickingNode) {
        stopNodePick()
      } else if (selectedNode) {
        goToList()
      } else {
        closeAIColab()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAIColabMode, isPickingNode, selectedNode, draftText, closeAIColab, stopNodePick, goToList])

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
      setPanelView,
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
      setPanelView,
      copyToClipboard,
    ]
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


