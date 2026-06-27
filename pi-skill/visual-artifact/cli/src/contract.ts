import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { ArtifactContract } from "./types.ts"

import bundledContract from "./assets/contract.json" assert { type: "json" }

let contractCache: ArtifactContract | null = null

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

  contractCache = (bundledContract as unknown) as ArtifactContract
  return contractCache
}

export function resetContractCache(): void {
  contractCache = null
}
