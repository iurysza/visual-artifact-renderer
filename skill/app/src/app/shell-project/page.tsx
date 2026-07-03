import type { Metadata } from "next"

import { ProjectIndexLoader } from "@/components/project-index-loader"

export const metadata: Metadata = {
  title: "Projects",
}

export default function LiveProjectIndexPage() {
  return <ProjectIndexLoader />
}
