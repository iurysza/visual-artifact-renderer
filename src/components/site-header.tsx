"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ThemeToggle } from "@/components/theme-toggle"

const BASE_PATH = "/artifacts"

function humanize(slug: string) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function SiteHeader() {
  const pathname = usePathname()
  const routePath = pathname?.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || "/"
    : pathname || "/"

  const segments = routePath.split("/").filter(Boolean)

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {segments.length === 0 ? (
                <BreadcrumbPage className="flex items-center gap-1.5">
                  <Home data-icon="inline-start" />
                  Home
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href="/" />} className="flex items-center gap-1.5">
                  <Home data-icon="inline-start" />
                  Home
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>

            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1
              const href = "/" + segments.slice(0, index + 1).join("/") + "/"
              const label = humanize(segment)

              return (
                <React.Fragment key={`${segment}-${index}`}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={href} />}>{label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <ThemeToggle className="shrink-0" />
      </div>
    </header>
  )
}
