import { listProjects, listArtifactsInProject, getVisualArtifactSpec } from "@/lib/artifacts"
import { ClientArtifactLoader } from "@/components/client-artifact-loader"

export async function generateStaticParams() {
  const projects = await listProjects()
  const params = []
  
  for (const project of projects) {
    const artifacts = await listArtifactsInProject(project.name)
    for (const artifact of artifacts) {
      params.push({ project: project.name, slug: artifact.slug })
    }
  }
  
  return params
}

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ project: string; slug: string }>
}) {
  const { project, slug } = await params
  
  // Try to load at build time for SSR
  const initialSpec = await getVisualArtifactSpec(project, slug)
  
  if (initialSpec) {
    // Render from the build-time spec immediately, then re-fetch client-side for live updates.
    return <ClientArtifactLoader project={project} slug={slug} initialSpec={initialSpec} />
  }

  return <ClientArtifactLoader project={project} slug={slug} />
}
