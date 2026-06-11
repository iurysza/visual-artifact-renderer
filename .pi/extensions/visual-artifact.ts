import { mkdir, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"

import { StringEnum, Type } from "@earendil-works/pi-ai"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent"

import { VisualArtifactSpecSchema } from "../../src/lib/artifact-schema"

const DEFAULT_BASE_URL = "http://localhost:9999"

const CreateVisualArtifactParams = Type.Object({
  slug: Type.String({
    description: "kebab-case artifact slug. Example: revenue-dashboard",
  }),
  title: Type.String({ description: "Artifact title" }),
  description: Type.Optional(Type.String({ description: "Short artifact description" })),
  layout: Type.Optional(
    Type.Object({
      type: Type.Optional(StringEnum(["default", "grid"] as const)),
      columns: Type.Optional(Type.Number({ minimum: 1, maximum: 4 })),
    })
  ),
  data: Type.Optional(
    Type.Record(Type.String(), Type.Any(), {
      description: "Embedded datasets. Data views reference datasets by dataKey.",
    })
  ),
  nodes: Type.Array(Type.Any(), {
    description:
      "ArtifactNode[]. Use the manifest in src/lib/artifact-manifest.ts for supported node types and props.",
  }),
})

export default function visualArtifactExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "create_visual_artifact",
    label: "Create Visual Artifact",
    description:
      "Validate and save a visual artifact JSON spec to src/artifacts/<slug>.json, then return its local /artifacts/<slug> URL.",
    promptSnippet:
      "Create a visual artifact page from a constrained JSON spec and return its local URL.",
    promptGuidelines: [
      "Use create_visual_artifact when the user asks to create a visual page, report, dashboard, plan, explainer, or document artifact from structured content.",
      "Before calling create_visual_artifact, follow the supported node manifest in src/lib/artifact-manifest.ts and do not invent JSX, imports, or unsupported node types.",
      "For dashboards and reports, prefer stat-card for top KPIs, status-grid for health/readiness/risk boards, and comparison-table for checks, options, risks, and runtime matrices.",
      "Use generic cards for narrative chunks with child nodes, not for every small fact. Avoid file:// links; link to app routes or public URLs.",
    ],
    parameters: CreateVisualArtifactParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const spec = VisualArtifactSpecSchema.parse(params)
      const filePath = resolve(ctx.cwd, "src", "artifacts", `${spec.slug}.json`)
      const url = `${process.env.VISUAL_ARTIFACT_BASE_URL ?? DEFAULT_BASE_URL}/artifacts/${spec.slug}`

      await withFileMutationQueue(filePath, async () => {
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, `${JSON.stringify(spec, null, 2)}\n`, "utf8")
      })

      const relativePath = relative(ctx.cwd, filePath)

      return {
        content: [
          {
            type: "text",
            text: `Created visual artifact ${spec.slug} at ${relativePath}. Open ${url}`,
          },
        ],
        details: {
          slug: spec.slug,
          path: filePath,
          relativePath,
          url,
        },
      }
    },
  })
}
