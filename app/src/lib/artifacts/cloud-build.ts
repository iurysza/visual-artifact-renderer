export const CLOUD_BUILD_ROUTE_STRATEGIES = ["zero-pages", "placeholder"] as const
export type CloudBuildRouteStrategy = (typeof CLOUD_BUILD_ROUTE_STRATEGIES)[number]

const DEFAULT_CLOUD_BUILD_ROUTE_STRATEGY: CloudBuildRouteStrategy = "zero-pages"

export function isCloudBuild(): boolean {
  return process.env.VISUAL_ARTIFACT_CLOUD_BUILD === "1"
}

export function cloudBuildRouteStrategy(): CloudBuildRouteStrategy {
  const value = process.env.VISUAL_ARTIFACT_CLOUD_ROUTE_STRATEGY?.trim() || DEFAULT_CLOUD_BUILD_ROUTE_STRATEGY
  if (CLOUD_BUILD_ROUTE_STRATEGIES.includes(value as CloudBuildRouteStrategy)) {
    return value as CloudBuildRouteStrategy
  }
  throw new Error(
    `Invalid VISUAL_ARTIFACT_CLOUD_ROUTE_STRATEGY: ${value}. Expected ${CLOUD_BUILD_ROUTE_STRATEGIES.join(" or ")}.`,
  )
}

export const CLOUD_BUILD_PLACEHOLDER_PROJECT = "visualizer"
export const CLOUD_BUILD_PLACEHOLDER_SLUG = "placeholder"

export function cloudBuildProjectParams(): { project: string }[] {
  if (!isCloudBuild()) return []
  return [{ project: CLOUD_BUILD_PLACEHOLDER_PROJECT }]
}

export function cloudBuildArtifactParams(): { project: string; slug: string }[] {
  if (!isCloudBuild()) return []
  return [{ project: CLOUD_BUILD_PLACEHOLDER_PROJECT, slug: CLOUD_BUILD_PLACEHOLDER_SLUG }]
}
