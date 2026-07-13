"use client"

import { usePathname } from "next/navigation"

import { SiteHeader } from "@/components/site-header"

function isArtifactDetail(pathname: string) {
  const segments = pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean)
  return segments.length === 2
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <>
      {!isArtifactDetail(pathname ?? "") && <SiteHeader />}
      {children}
    </>
  )
}
