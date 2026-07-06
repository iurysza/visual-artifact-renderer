export interface CommentListItemTarget {
  kind: "artifact" | "node"
  nodeId?: string
  nodePath?: string
  nodeType?: string
  label: string
}

export interface CommentListItem {
  id: string
  target: CommentListItemTarget
  body: string
  authorName?: string
  createdAt?: string
  updatedAt?: string
  replyCount?: number
  status?: "open" | "resolved"
  isActive?: boolean
}
