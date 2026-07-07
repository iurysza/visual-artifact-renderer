"use client"

import { usePathname } from "next/navigation"

import { SiteHeader } from "@/components/site-header"

function isArtifactDetail(pathname: string) {
  const base = "/artifacts"
  const routePath = pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname
  const segments = routePath.replace(/^\/|\/$/g, "").split("/").filter(Boolean)
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
