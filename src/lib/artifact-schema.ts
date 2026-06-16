import { z } from "zod"

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
      type: "prose"
      props: { content: string }
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
    z
      .object({
        type: z.literal("definition-list"),
        props: z
          .object({
            items: z.array(
              z
                .object({
                  term: z.string().min(1),
                  description: z.string().min(1),
                })
                .strict()
            ).min(1),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("file-tree"),
        props: z
          .object({
            items: z.array(FileTreeItemSchema).min(1),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("heading"),
        props: z
          .object({
            text: z.string().min(1),
            level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
            align: TextAlignSchema.optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("text"),
        props: z
          .object({
            text: z.string().min(1),
            tone: z.enum(["default", "muted"]).optional(),
            size: z.enum(["sm", "base", "lg"]).optional(),
            align: TextAlignSchema.optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("card"),
        props: z
          .object({
            title: z.string().min(1).optional(),
            description: z.string().min(1).optional(),
            size: z.enum(["default", "sm"]).optional(),
            tone: ToneSchema.optional(),
          })
          .strict()
          .optional(),
        children: childNodes,
      })
      .strict(),
    z
      .object({
        type: z.literal("metric"),
        props: z
          .object({
            label: z.string().min(1),
            value: z.union([z.string(), z.number()]),
            delta: z.string().min(1).optional(),
            trend: TrendSchema.optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("stat-card"),
        props: z
          .object({
            label: z.string().min(1),
            value: z.union([z.string(), z.number()]),
            delta: z.string().min(1).optional(),
            trend: TrendSchema.optional(),
            caption: z.string().min(1).optional(),
            tone: ToneSchema.optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("badge"),
        props: z
          .object({
            label: z.string().min(1),
            variant: BadgeVariantSchema.optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("button"),
        props: z
          .object({
            label: z.string().min(1),
            href: z.string().min(1).optional(),
            variant: ButtonVariantSchema.optional(),
            size: ButtonSizeSchema.optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("separator"),
        props: z.object({}).strict().optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("table"),
        props: z
          .object({
            dataKey: z.string().min(1),
            columns: z.array(ColumnSchema).min(1).optional(),
            caption: z.string().min(1).optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("data-table"),
        props: z
          .object({
            dataKey: z.string().min(1),
            columns: z.array(ColumnSchema).min(1).optional(),
            caption: z.string().min(1).optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("comparison-table"),
        props: z
          .object({
            dataKey: z.string().min(1),
            columns: z.array(ColumnSchema).min(1).optional(),
            statusKey: z.string().min(1).optional(),
            caption: z.string().min(1).optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("chart"),
        props: z
          .object({
            dataKey: z.string().min(1),
            xKey: z.string().min(1),
            yKey: z.string().min(1),
            kind: ChartKindSchema.optional(),
            label: z.string().min(1).optional(),
            color: z.string().min(1).optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("mermaid"),
        props: z
          .object({
            code: z.string().min(1),
            title: z.string().min(1).optional(),
            caption: z.string().min(1).optional(),
            height: DiagramHeightSchema.optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("svg-diagram"),
        props: z
          .object({
            html: z.string().min(1),
            title: z.string().min(1).optional(),
            caption: z.string().min(1).optional(),
            height: DiagramHeightSchema.optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("flow"),
        props: z
          .object({
            title: z.string().min(1).optional(),
            caption: z.string().min(1).optional(),
            items: z.array(FlowItemSchema).min(2),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("timeline"),
        props: z
          .object({
            dataKey: z.string().min(1),
            titleKey: z.string().min(1).optional(),
            markerKey: z.string().min(1).optional(),
            descriptionKey: z.string().min(1).optional(),
            statusKey: z.string().min(1).optional(),
            caption: z.string().min(1).optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("code-block"),
        props: z
          .object({
            title: z.string().min(1).optional(),
            language: z.string().min(1).optional(),
            code: z.string().min(1),
            caption: z.string().min(1).optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("status-grid"),
        props: z
          .object({
            dataKey: z.string().min(1),
            titleKey: z.string().min(1).optional(),
            statusKey: z.string().min(1),
            descriptionKey: z.string().min(1).optional(),
            metaKey: z.string().min(1).optional(),
            columns: GridColumnsSchema.optional(),
            caption: z.string().min(1).optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("grid"),
        props: z
          .object({
            columns: GridColumnsSchema.optional(),
          })
          .strict()
          .optional(),
        children: childNodes,
      })
      .strict(),
    z
      .object({
        type: z.literal("section"),
        props: z
          .object({
            title: z.string().min(1).optional(),
            description: z.string().min(1).optional(),
          })
          .strict()
          .optional(),
        children: childNodes,
      })
      .strict(),
    z
      .object({
        type: z.literal("tabs"),
        props: z
          .object({
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
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal("accordion"),
        props: z
          .object({
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
          })
          .strict(),
      })
      .strict(),
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
  "definition-list",
  "file-tree",
  "heading",
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
] as const satisfies readonly ArtifactNode["type"][]
