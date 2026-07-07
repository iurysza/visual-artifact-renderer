import type { Metadata } from "next"

import { listProjects, listArtifactsInProject, getVisualArtifactSpec } from "@/lib/artifacts/artifacts"
import { cloudBuildArtifactParams, isCloudBuild } from "@/lib/artifacts/cloud-build"
import { ArtifactPageShell } from "@/components/artifact-page-shell"

export async function generateStaticParams() {
  if (isCloudBuild()) return cloudBuildArtifactParams()

  const projects = await listProjects()
  const params: { project: string; slug: string }[] = []
  for (const project of projects) {
    const artifacts = await listArtifactsInProject(project.name)
    for (const artifact of artifacts) {
      params.push({ project: project.name, slug: artifact.slug })
    }
  }
  if (params.length === 0) {
    return [{ project: "visualizer", slug: "placeholder" }]
  }
  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ project: string; slug: string }>
}): Promise<Metadata> {
  const { project, slug } = await params
  if (isCloudBuild()) return { title: slug }

  const spec = await getVisualArtifactSpec(project, slug)
  return { title: spec?.title ?? slug }
}

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ project: string; slug: string }>
}) {
  const { project, slug } = await params

  // Try to load at build time for SSR. Cloud builds must stay shell-only;
  // the Worker serves this shell for remote artifact routes and loads JSON from R2.
  const initialSpec = isCloudBuild() ? null : await getVisualArtifactSpec(project, slug)

  if (initialSpec) {
    // Render from the build-time spec immediately, then re-fetch client-side for live updates.
    return <ArtifactPageShell project={project} slug={slug} initialSpec={initialSpec} />
  }

  return <ArtifactPageShell project={project} slug={slug} />
}
