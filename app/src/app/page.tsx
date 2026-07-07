import type { Metadata } from "next"

import { ArtifactIndexLoader } from "@/components/artifact-index-loader"

export const metadata: Metadata = {
  title: "Artifacts",
}

export default function Home() {
  return <ArtifactIndexLoader />
}
