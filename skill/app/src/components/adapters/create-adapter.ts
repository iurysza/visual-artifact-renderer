import type { ReactNode } from "react"

import type { ArtifactNode } from "@/lib/artifact-schema"
import type { AdapterArgs, RegistryAdapter } from "@/components/artifact-types"

export function createAdapter<T extends ArtifactNode["type"]>(
  render: (args: AdapterArgs<T>) => ReactNode
): RegistryAdapter {
  return render as RegistryAdapter
}
