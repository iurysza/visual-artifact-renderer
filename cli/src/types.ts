export type {
  ArtifactContract,
  NodeDef,
  SpecConstraints,
} from "@agents/visual-artifact-annotations/contract"

export interface ArtifactSpec {
  slug: string
  title: string
  description?: string
  createdAt?: string
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
