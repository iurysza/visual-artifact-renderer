export interface SpecConstraints {
  slug: {
    type: string
    format: string
    minLength: number
    maxLength: number
  }
  title: {
    type: string
    minLength: number
  }
  description: {
    type: string
    minLength: number
    optional: boolean
  }
  layout: {
    type: {
      enum: string[]
    }
    columns: {
      enum: number[]
    }
  }
  nodes: {
    type: string
    minItems: number
  }
}

export interface ArtifactContract {
  version: string
  spec: SpecConstraints
  nodeTypes: readonly string[]
  nodes: Record<string, NodeDef>
  dataNodes: readonly string[]
  compositionGuidance: readonly string[]
  patternExamples: Record<string, { description: string; nodes: unknown[] }>
}

export interface NodeDef {
  description: string
  props: Record<string, string>
  children: false | "nodes" | "items"
  data?: string
  requiresData?: boolean
  example: unknown
}

export interface ArtifactSpec {
  slug: string
  title: string
  description?: string
  layout?: {
    type?: "default" | "grid"
    columns?: number
  }
  data?: Record<string, unknown>
  nodes: unknown[]
}

export interface GlobalOpts {
  json: boolean
  plain: boolean
  quiet: boolean
  verbose: boolean
  noColor: boolean
  noInput: boolean
}

export interface Config {
  artifactsDir: string
  outDir: string
  port: number
  host: string
  mountPath: string
  dataPath: string
  open: boolean
  baseUrl?: string
}
