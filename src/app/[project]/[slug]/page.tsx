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
    // If we have it at build time, render it natively!
    // But we still wrap it in ClientArtifactLoader? No, if we have it at build time we can just render.
    // The instruction: "load artifact JSON client-side (or at build time for shell/SEO + client for full data)"
    // If we just render VisualArtifactRenderer, it will be fully static, but what if JSON changes on disk?
    // Let's pass the initialSpec to ClientArtifactLoader so it renders immediately but can re-fetch?
    // Actually, if we use ClientArtifactLoader with initial data, it can update itself.
    return <ClientArtifactLoader project={project} slug={slug} initialSpec={initialSpec} />
  }

  // If not available at build time (e.g. fallback), load purely on client.
  return <ClientArtifactLoader project={project} slug={slug} />
}
