import type { Metadata } from "next"

import { ClientArtifactLoader } from "@/components/client-artifact-loader"

export const metadata: Metadata = {
  title: "Live artifact",
}

export default function LiveArtifactPage() {
  return <ClientArtifactLoader />
}
