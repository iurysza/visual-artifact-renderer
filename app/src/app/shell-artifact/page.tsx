import type { Metadata } from "next"

import { LiveArtifactPageShell } from "@/components/artifact-page-shell"

export const metadata: Metadata = {
  title: "Live artifact",
}

export default function LiveArtifactPage() {
  return <LiveArtifactPageShell />
}
