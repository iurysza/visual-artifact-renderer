import { notFound } from "next/navigation"
import { listProjects } from "@/lib/artifacts/artifacts"
import { isReservedRootSegment } from "@/lib/artifacts/paths"
import { cloudBuildProjectParams, isCloudBuild } from "@/lib/artifacts/cloud-build"
import { ProjectIndexLoader } from "@/components/project-index-loader"

export async function generateStaticParams() {
  if (isCloudBuild()) return cloudBuildProjectParams()

  const projects = await listProjects()
  const filtered = projects.filter((project) => !isReservedRootSegment(project.name))
  if (filtered.length === 0) {
    return [{ project: "visualizer" }]
  }
  return filtered.map((project) => ({ project: project.name }))
}

export default async function ProjectArtifactsPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project } = await params
  if (isReservedRootSegment(project)) notFound()
  return <ProjectIndexLoader project={project} />
}
