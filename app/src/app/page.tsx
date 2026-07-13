import type { Metadata } from "next"

import { AlternativeArtifactIndexLoader } from "@/components/alternative-artifact-index-loader"
import { ArtifactIndexLoader } from "@/components/artifact-index-loader"

export const metadata: Metadata = {
  title: "Artifacts",
}

export default function Home() {
  if (process.env.VISUAL_ARTIFACT_HOME_VARIANT === "alternative") {
    return <AlternativeArtifactIndexLoader />
  }

  return <ArtifactIndexLoader />
}
