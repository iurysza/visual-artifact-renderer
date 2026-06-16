import type { ArtifactColumn, VisualArtifactSpec } from "@/lib/artifact-schema"

export function getRows(
  data: VisualArtifactSpec["data"],
  dataKey: string
): Record<string, unknown>[] {
  const dataset = data?.[dataKey]

  if (!Array.isArray(dataset)) {
    return []
  }

  return dataset.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && !Array.isArray(row)
  )
}

export function normalizeColumns(
  columns: ArtifactColumn[] | undefined,
  data: Record<string, unknown>[]
) {
  const source = columns?.length ? columns : Object.keys(data[0] ?? {})

  return source.map((column) => {
    if (typeof column === "string") {
      return { key: column, label: toTitle(column) }
    }

    return { key: column.key, label: column.label ?? toTitle(column.key) }
  })
}

export function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") return value.toLocaleString()
  if (typeof value === "string") return value
  if (typeof value === "boolean") return value ? "Yes" : "No"

  return JSON.stringify(value)
}

export function toTitle(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function MissingData({ dataKey }: { dataKey: string }) {
  return (
    <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      Missing dataset: {dataKey}
    </p>
  )
}
