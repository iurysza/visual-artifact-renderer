import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createArtifactContract } from "@agents/visual-artifact-annotations/contract"
import { defaultContractPath } from "./config.ts"
import type { ArtifactContract } from "./types.ts"

let contractCache: ArtifactContract | null = null

async function loadBundledContract(): Promise<ArtifactContract> {
  return createArtifactContract()
}

export async function loadContract(contractPath?: string): Promise<ArtifactContract> {
  if (contractCache) return contractCache

  if (contractPath) {
    const raw = await readFile(resolve(contractPath), "utf8")
    contractCache = JSON.parse(raw) as ArtifactContract
    return contractCache
  }

  const envPath = process.env.VISUAL_ARTIFACT_CONTRACT_PATH
  if (envPath) {
    const raw = await readFile(resolve(envPath), "utf8")
    contractCache = JSON.parse(raw) as ArtifactContract
    return contractCache
  }

  const skillContract = defaultContractPath()
  if (skillContract) {
    try {
      const raw = await readFile(skillContract, "utf8")
      contractCache = JSON.parse(raw) as ArtifactContract
      return contractCache
    } catch {
      // fall through to bundled contract
    }
  }

  const bundledContract = await loadBundledContract()
  contractCache = bundledContract
  return contractCache
}

export function resetContractCache(): void {
  contractCache = null
}
