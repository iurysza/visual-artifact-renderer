export type {
  ArtifactContract,
  NodeDef,
  SpecConstraints,
  VisualArtifactSpec as ArtifactSpec,
} from "@agents/visual-artifact-annotations/contract"

export interface GlobalOpts {
  json: boolean
  plain: boolean
  quiet: boolean
  verbose: boolean
  noColor: boolean
  noInput: boolean
  allowRemote?: boolean
}

export interface Config {
  artifactsDir: string
  outDir: string
  port: number
  host: string
  mountPath: string
  dataPath: string
  open: boolean
  allowRemote: boolean
  baseUrl?: string
  contractPath?: string
  projectPath?: string
}
