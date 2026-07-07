export interface FileTreeItem {
  name: string
  type?: "file" | "directory"
  children?: FileTreeItem[]
  /** File contents; when present the file is tappable and renders in a code-block. */
  content?: string
  /** Shiki language hint for the code-block (e.g. typescript, bash, json). */
  language?: string
  /** Repo-relative or absolute path; `create` reads it and inlines `content`. */
  src?: string
}

export type GitStatusValue =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "ignored"

export type GitStatus = {
  status: GitStatusValue
  descendant?: boolean
}

export type FlattenedItem = FileTreeItem & {
  path: string
  depth: number
  flattenedName?: string
}

export function flattenEmptyDirectories(
  items: FileTreeItem[],
  pathPrefix = "",
  depth = 0
): FlattenedItem[] {
  const result: FlattenedItem[] = []

  for (const item of items) {
    const currentPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name
    const children = item.children ?? []
    const isDirectory = item.type === "directory" || children.length > 0

    if (isDirectory && children.length === 1) {
      const onlyChild = children[0]
      const onlyChildIsDirectory =
        onlyChild.type === "directory" || (onlyChild.children && onlyChild.children.length > 0)

      if (onlyChildIsDirectory) {
        // Flatten: keep the parent path and combine the name with the child chain.
        const flattened = flattenEmptyDirectories([onlyChild], currentPath, depth)
        for (const child of flattened) {
          result.push({
            ...child,
            flattenedName: item.name + "/" + (child.flattenedName ?? child.name),
          })
        }
        continue
      }
    }

    result.push({ ...item, path: currentPath, depth })

    if (isDirectory && children.length > 0) {
      const flattenedChildren = flattenEmptyDirectories(children, currentPath, depth + 1)
      result.push(...flattenedChildren)
    }
  }

  return result
}

export function collectItems(
  items: FileTreeItem[],
  pathPrefix = "",
  depth = 0
): FlattenedItem[] {
  const result: FlattenedItem[] = []

  for (const item of items) {
    const currentPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name
    const children = item.children ?? []
    const isDirectory = item.type === "directory" || children.length > 0

    result.push({ ...item, path: currentPath, depth })

    if (isDirectory && children.length > 0) {
      result.push(...collectItems(children, currentPath, depth + 1))
    }
  }

  return result
}

export function matchesSearch(item: FlattenedItem, query: string): boolean {
  if (!query) return true
  const lowerQuery = query.toLowerCase()
  const name = (item.flattenedName ?? item.name).toLowerCase()
  return name.includes(lowerQuery)
}

export function filterVisibleItems(
  items: FlattenedItem[],
  query: string
): Set<string> {
  const visible = new Set<string>()
  if (!query) {
    for (const item of items) visible.add(item.path)
    return visible
  }

  const lowerQuery = query.toLowerCase()

  // Mark all items whose name matches.
  const matchedPaths = new Set<string>()
  for (const item of items) {
    const name = (item.flattenedName ?? item.name).toLowerCase()
    if (name.includes(lowerQuery)) {
      matchedPaths.add(item.path)
    }
  }

  // Make an ancestor map: child -> parent.
  const parentMap = new Map<string, string>()
  for (const item of items) {
    if (item.path.includes("/")) {
      parentMap.set(item.path, item.path.slice(0, item.path.lastIndexOf("/")))
    }
  }

  // Mark ancestors of matched items as visible; also mark descendants of matched folders.
  function markAncestors(path: string) {
    const parent = parentMap.get(path)
    if (parent) {
      visible.add(parent)
      markAncestors(parent)
    }
  }

  for (const path of matchedPaths) {
    visible.add(path)
    markAncestors(path)
  }

  return visible
}

export function getStatusIndicator(
  status: GitStatus | undefined
): { label: string | null; tone: "muted" | "amber" | "olive" | "rust" | "clay" | "blue" } {
  if (!status) return { label: null, tone: "muted" }
  if (status.descendant) return { label: "●", tone: "blue" }
  switch (status.status) {
    case "modified":
      return { label: "M", tone: "amber" }
    case "added":
      return { label: "A", tone: "olive" }
    case "deleted":
      return { label: "D", tone: "rust" }
    case "renamed":
      return { label: "R", tone: "clay" }
    case "untracked":
      return { label: "U", tone: "muted" }
    case "ignored":
      return { label: null, tone: "muted" }
    default:
      return { label: null, tone: "muted" }
  }
}
