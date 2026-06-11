import { notFound } from "next/navigation"

import { VisualArtifactRenderer } from "@/components/visual-artifact-renderer"
import { getVisualArtifactSpec } from "@/lib/artifacts"

export const dynamic = "force-dynamic"

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const spec = await getVisualArtifactSpec(slug)

  if (!spec) {
    notFound()
  }

  return <VisualArtifactRenderer spec={spec} />
}
