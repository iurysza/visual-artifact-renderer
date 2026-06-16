import { ProjectIndexLoader } from "@/components/project-index-loader"

export default async function ProjectArtifactsPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project } = await params
  return <ProjectIndexLoader project={project} />
}

export async function generateStaticParams() {
  // Keep the project route shells in the static export so direct project URLs
  // resolve without needing the live fallback.
  return [{ project: "visualizer" }]
}
