import { listProjects } from "@/lib/artifacts/artifacts"
import { cloudBuildProjectParams, isCloudBuild } from "@/lib/artifacts/cloud-build"
import { ProjectIndexLoader } from "@/components/project-index-loader"

export async function generateStaticParams() {
  if (isCloudBuild()) return cloudBuildProjectParams()

  const projects = await listProjects()
  if (projects.length === 0) {
    return [{ project: "visualizer" }]
  }
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
