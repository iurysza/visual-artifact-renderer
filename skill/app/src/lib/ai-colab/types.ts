export type AIColabCommentTarget =
  | { kind: "artifact" }
  | {
      kind: "node"
      nodePath: string
      nodeId?: string
      nodeType?: string
      label?: string
    }

export interface AIColabComment {
  id: string
  target: AIColabCommentTarget
  body: string
  createdAt?: string
}

export interface AIColabFormatOptions {
  comments?: AIColabComment[]
  filePath?: string
}