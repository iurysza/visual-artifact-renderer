import { listProjects } from "@/lib/artifacts/artifacts"
import { ProjectIndexLoader } from "@/components/project-index-loader"

export async function generateStaticParams() {
  const projects = await listProjects()
  return projects.map((project) => ({ project: project.name }))
}

export default async function ProjectArtifactsPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project } = await params
  return <ProjectIndexLoader project={project} />
}
