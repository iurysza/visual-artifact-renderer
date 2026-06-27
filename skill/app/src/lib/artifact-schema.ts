import { z } from "zod"

import { containerSchema, leafSchema, optionalPropsSchema } from "./schema-helpers"

export const ArtifactSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use kebab-case slugs")

const TextAlignSchema = z.enum(["left", "center", "right"])
const BadgeVariantSchema = z.enum([
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
])
const ButtonVariantSchema = z.enum([
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
])
const ButtonSizeSchema = z.enum(["default", "xs", "sm", "lg"])
const TrendSchema = z.enum(["up", "down", "neutral"])
const ChartKindSchema = z.enum(["line", "bar"])
const ToneSchema = z.enum(["default", "accent", "success", "warning", "danger"])
const GridColumnsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
const DiagramHeightSchema = z.number().int().min(240).max(1600)

const FlowItemSchema = z
  .object({
    title: z.string().min(1),
    label: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
  })
  .strict()

type FileTreeItem = {
  name: string
  type?: "file" | "directory"
  children?: FileTreeItem[]
}

const FileTreeItemSchema: z.ZodType<FileTreeItem> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    type: z.enum(["file", "directory"]).optional(),
    children: z.array(FileTreeItemSchema).optional(),
  })
)

const ColumnSchema = z.union([
  z.string().min(1),
  z
    .object({
      key: z.string().min(1),
      label: z.string().min(1).optional(),
    })
    .strict(),
])

export type ArtifactColumn = z.infer<typeof ColumnSchema>

export type ArtifactTone = z.infer<typeof ToneSchema>
export type ArtifactFlowItem = z.infer<typeof FlowItemSchema>

export type ArtifactNode =
  | {
      type: "definition-list"
      props: { items: { term: string; description: string }[] }
    }
  | {
      type: "file-tree"
      props: { items: FileTreeItem[] }
    }
  | {
      type: "diff"
      props: {
        before: string
        after: string
        language?: string
        title?: string
        defaultOpen?: boolean
      }
    }
  | {
      type: "stepper"
      props: { items: { title: string; description?: string; status?: "complete" | "current" | "pending" }[] }
    }
  | {
      type: "image"
      props: { src: string; alt: string; caption?: string; aspect?: "auto" | "square" | "video" | "wide" }
    }
  | {
      type: "alert"
      props: { title: string; description?: string; variant?: "default" | "destructive" }
    }
  | {
      type: "pie-chart"
      props: { dataKey: string; categoryKey: string; valueKey: string }
    }
  | {
      type: "donut-chart"
      props: { dataKey: string; categoryKey: string; valueKey: string }
    }
  | {
      type: "area-chart"
      props: { dataKey: string; xKey?: string; yKey?: string; label?: string; color?: string }
    }
  | {
      type: "radar-chart"
      props: { dataKey: string; subjectKey?: string; valueKey?: string; label?: string; color?: string }
    }
  | {
      type: "scatter-chart"
      props: { dataKey: string; xKey?: string; yKey?: string; label?: string; color?: string }
    }
  | {
      type: "heatmap"
      props: { dataKey: string; xKey?: string; yKey?: string; valueKey?: string; caption?: string }
    }
  | {
      type: "log"
      props: { lines?: string[]; dataKey?: string }
    }
  | {
      type: "prose"
      props: { content: string; tone?: "default" | "muted" }
    }
  | {
      type: "heading"
      props: { text: string; level?: 1 | 2 | 3 | 4; align?: "left" | "center" | "right" }
    }
  | {
      type: "text"
      props: { text: string; tone?: "default" | "muted"; size?: "sm" | "base" | "lg"; align?: "left" | "center" | "right" }
    }
  | {
      type: "card"
      props?: { title?: string; description?: string; size?: "default" | "sm"; tone?: ArtifactTone }
      children?: ArtifactNode[]
    }
  | {
      type: "metric"
      props: { label: string; value: string | number; delta?: string; trend?: "up" | "down" | "neutral" }
    }
  | {
      type: "stat-card"
      props: { label: string; value: string | number; delta?: string; trend?: "up" | "down" | "neutral"; caption?: string; tone?: ArtifactTone }
    }
  | {
      type: "badge"
      props: { label: string; variant?: z.infer<typeof BadgeVariantSchema> }
    }
  | {
      type: "button"
      props: { label: string; href?: string; variant?: z.infer<typeof ButtonVariantSchema>; size?: z.infer<typeof ButtonSizeSchema> }
    }
  | { type: "separator"; props?: Record<string, never> }
  | {
      type: "table"
      props: { dataKey: string; columns?: ArtifactColumn[]; caption?: string }
    }
  | {
      type: "data-table"
      props: { dataKey: string; columns?: ArtifactColumn[]; caption?: string }
    }
  | {
      type: "comparison-table"
      props: { dataKey: string; columns?: ArtifactColumn[]; statusKey?: string; caption?: string }
    }
  | {
      type: "chart"
      props: { dataKey: string; xKey: string; yKey: string; kind?: "line" | "bar"; label?: string; color?: string }
    }
  | {
      type: "mermaid"
      props: { code: string; title?: string; caption?: string; height?: number }
    }
  | {
      type: "svg-diagram"
      props: { html: string; title?: string; caption?: string; height?: number }
    }
  | {
      type: "flow"
      props: { title?: string; caption?: string; items: ArtifactFlowItem[] }
    }
  | {
      type: "timeline"
      props: { dataKey: string; titleKey?: string; markerKey?: string; descriptionKey?: string; statusKey?: string; caption?: string }
    }
  | {
      type: "code-block"
      props: { title?: string; language?: string; code: string; caption?: string }
    }
  | {
      type: "status-grid"
      props: { dataKey: string; titleKey?: string; statusKey: string; descriptionKey?: string; metaKey?: string; columns?: 1 | 2 | 3 | 4; caption?: string }
    }
  | {
      type: "grid"
      props?: { columns?: 1 | 2 | 3 | 4 }
      children?: ArtifactNode[]
    }
  | {
      type: "section"
      props?: { title?: string; description?: string }
      children?: ArtifactNode[]
    }
  | {
      type: "tabs"
      props: {
        defaultValue?: string
        items: { value: string; label: string; nodes: ArtifactNode[] }[]
      }
    }
  | {
      type: "accordion"
      props: {
        items: { title: string; nodes: ArtifactNode[] }[]
      }
    }

export const ArtifactNodeSchema: z.ZodType<ArtifactNode> = z.lazy(() => {
  const childNodes = z.array(ArtifactNodeSchema).optional()
  const requiredChildNodes = z.array(ArtifactNodeSchema).min(1)

  return z.discriminatedUnion("type", [
    leafSchema("definition-list", {
      items: z.array(
        z
          .object({
            term: z.string().min(1),
            description: z.string().min(1),
          })
          .strict()
      ).min(1),
    }),
    leafSchema("file-tree", {
      items: z.array(FileTreeItemSchema).min(1),
    }),
    leafSchema("diff", {
      before: z.string(),
      after: z.string(),
      language: z.string().optional(),
      title: z.string().optional(),
      defaultOpen: z.boolean().optional(),
    }),
    leafSchema("stepper", {
      items: z.array(
        z
          .object({
            title: z.string().min(1),
            description: z.string().optional(),
            status: z.enum(["complete", "current", "pending"]).optional(),
          })
          .strict()
      ).min(1),
    }),
    leafSchema("image", {
      src: z.string(),
      alt: z.string(),
      caption: z.string().optional(),
      aspect: z.enum(["auto", "square", "video", "wide"]).optional(),
    }),
    leafSchema("alert", {
      title: z.string().min(1),
      description: z.string().optional(),
      variant: z.enum(["default", "destructive"]).optional(),
    }),
    leafSchema("pie-chart", {
      dataKey: z.string().min(1),
      categoryKey: z.string().min(1),
      valueKey: z.string().min(1),
    }),
    leafSchema("donut-chart", {
      dataKey: z.string().min(1),
      categoryKey: z.string().min(1),
      valueKey: z.string().min(1),
    }),
    leafSchema("area-chart", {
      dataKey: z.string().min(1),
      xKey: z.string().min(1).optional(),
      yKey: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
    }),
    leafSchema("radar-chart", {
      dataKey: z.string().min(1),
      subjectKey: z.string().min(1).optional(),
      valueKey: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
    }),
    leafSchema("scatter-chart", {
      dataKey: z.string().min(1),
      xKey: z.string().min(1).optional(),
      yKey: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
    }),
    leafSchema("heatmap", {
      dataKey: z.string().min(1),
      xKey: z.string().min(1).optional(),
      yKey: z.string().min(1).optional(),
      valueKey: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("log", {
      lines: z.array(z.string()).optional(),
      dataKey: z.string().min(1).optional(),
    }),
    leafSchema("prose", {
      content: z.string().min(1),
      tone: z.enum(["default", "muted"]).optional(),
    }),
    leafSchema("heading", {
      text: z.string().min(1),
      level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      align: TextAlignSchema.optional(),
    }),
    leafSchema("text", {
      text: z.string().min(1),
      tone: z.enum(["default", "muted"]).optional(),
      size: z.enum(["sm", "base", "lg"]).optional(),
      align: TextAlignSchema.optional(),
    }),
    containerSchema(
      "card",
      {
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        size: z.enum(["default", "sm"]).optional(),
        tone: ToneSchema.optional(),
      },
      childNodes
    ),
    leafSchema("metric", {
      label: z.string().min(1),
      value: z.union([z.string(), z.number()]),
      delta: z.string().min(1).optional(),
      trend: TrendSchema.optional(),
    }),
    leafSchema("stat-card", {
      label: z.string().min(1),
      value: z.union([z.string(), z.number()]),
      delta: z.string().min(1).optional(),
      trend: TrendSchema.optional(),
      caption: z.string().min(1).optional(),
      tone: ToneSchema.optional(),
    }),
    leafSchema("badge", {
      label: z.string().min(1),
      variant: BadgeVariantSchema.optional(),
    }),
    leafSchema("button", {
      label: z.string().min(1),
      href: z.string().min(1).optional(),
      variant: ButtonVariantSchema.optional(),
      size: ButtonSizeSchema.optional(),
    }),
    optionalPropsSchema("separator", {}),
    leafSchema("table", {
      dataKey: z.string().min(1),
      columns: z.array(ColumnSchema).min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("data-table", {
      dataKey: z.string().min(1),
      columns: z.array(ColumnSchema).min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("comparison-table", {
      dataKey: z.string().min(1),
      columns: z.array(ColumnSchema).min(1).optional(),
      statusKey: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("chart", {
      dataKey: z.string().min(1),
      xKey: z.string().min(1),
      yKey: z.string().min(1),
      kind: ChartKindSchema.optional(),
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
    }),
    leafSchema("mermaid", {
      code: z.string().min(1),
      title: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
      height: DiagramHeightSchema.optional(),
    }),
    leafSchema("svg-diagram", {
      html: z.string().min(1),
      title: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
      height: DiagramHeightSchema.optional(),
    }),
    leafSchema("flow", {
      title: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
      items: z.array(FlowItemSchema).min(2),
    }),
    leafSchema("timeline", {
      dataKey: z.string().min(1),
      titleKey: z.string().min(1).optional(),
      markerKey: z.string().min(1).optional(),
      descriptionKey: z.string().min(1).optional(),
      statusKey: z.string().min(1).optional(),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("code-block", {
      title: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      code: z.string().min(1),
      caption: z.string().min(1).optional(),
    }),
    leafSchema("status-grid", {
      dataKey: z.string().min(1),
      titleKey: z.string().min(1).optional(),
      statusKey: z.string().min(1),
      descriptionKey: z.string().min(1).optional(),
      metaKey: z.string().min(1).optional(),
      columns: GridColumnsSchema.optional(),
      caption: z.string().min(1).optional(),
    }),
    containerSchema(
      "grid",
      {
        columns: GridColumnsSchema.optional(),
      },
      childNodes
    ),
    containerSchema(
      "section",
      {
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
      },
      childNodes
    ),
    leafSchema("tabs", {
      defaultValue: z.string().min(1).optional(),
      items: z
        .array(
          z
            .object({
              value: z.string().min(1),
              label: z.string().min(1),
              nodes: requiredChildNodes,
            })
            .strict()
        )
        .min(1),
    }),
    leafSchema("accordion", {
      items: z
        .array(
          z
            .object({
              title: z.string().min(1),
              nodes: requiredChildNodes,
            })
            .strict()
        )
        .min(1),
    }),
  ])
})

export const VisualArtifactSpecSchema = z
  .object({
    slug: ArtifactSlugSchema,
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    layout: z
      .object({
        type: z.enum(["default", "grid"]).optional(),
        columns: GridColumnsSchema.optional(),
      })
      .strict()
      .optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    nodes: z.array(ArtifactNodeSchema).min(1),
  })
  .strict()
  .superRefine((spec, context) => {
    const visit = (nodes: ArtifactNode[], path: (string | number)[]) => {
      nodes.forEach((node, index) => {
        const nodePath = [...path, index]

        if (
          node.type === "table" ||
          node.type === "data-table" ||
          node.type === "comparison-table" ||
          node.type === "chart" ||
          node.type === "timeline" ||
          node.type === "status-grid"
        ) {
          const dataset = spec.data?.[node.props.dataKey]

          if (!dataset) {
            context.addIssue({
              code: "custom",
              message: `Missing data.${node.props.dataKey}`,
              path: [...nodePath, "props", "dataKey"],
            })
          } else if (!Array.isArray(dataset)) {
            context.addIssue({
              code: "custom",
              message: `data.${node.props.dataKey} must be an array`,
              path: [...nodePath, "props", "dataKey"],
            })
          }
        }

        if ((node.type === "card" || node.type === "grid" || node.type === "section") && node.children) {
          visit(node.children, [...nodePath, "children"])
        }

        if (node.type === "image" && /^file:\/\//i.test(node.props.src)) {
          context.addIssue({
            code: "custom",
            message: "image src must not use file:// URLs; use a relative sidecar path or an HTTPS URL",
            path: [...nodePath, "props", "src"],
          })
        }

        if (node.type === "button" && node.props.href && /^file:\/\//i.test(node.props.href)) {
          context.addIssue({
            code: "custom",
            message: "button href must not use file:// URLs; use an app route or HTTPS URL",
            path: [...nodePath, "props", "href"],
          })
        }

        if (node.type === "tabs") {
          node.props.items.forEach((item, itemIndex) => {
            visit(item.nodes, [...nodePath, "props", "items", itemIndex, "nodes"])
          })
        }

        if (node.type === "accordion") {
          node.props.items.forEach((item, itemIndex) => {
            visit(item.nodes, [...nodePath, "props", "items", itemIndex, "nodes"])
          })
        }
      })
    }

    visit(spec.nodes, ["nodes"])
  })

export type VisualArtifactSpec = z.infer<typeof VisualArtifactSpecSchema>

export const ARTIFACT_NODE_TYPES = [
  "alert",
  "area-chart",
  "radar-chart",
  "scatter-chart",
  "heatmap",
  "log",
  "definition-list",
  "diff",
  "donut-chart",
  "file-tree",
  "heading",
  "image",
  "pie-chart",
  "stepper",
  "text",
  "card",
  "metric",
  "stat-card",
  "badge",
  "button",
  "separator",
  "table",
  "data-table",
  "comparison-table",
  "chart",
  "mermaid",
  "svg-diagram",
  "flow",
  "timeline",
  "code-block",
  "status-grid",
  "grid",
  "section",
  "tabs",
  "accordion",
  "prose",
] as const satisfies readonly ArtifactNode["type"][]
