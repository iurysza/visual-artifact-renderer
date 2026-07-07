"use client"

import * as React from "react"
import {
  ChevronRight,
  File,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  Image as ImageIcon,
  Search,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { CodeBlock } from "@/components/ui/code-block"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type {
  FileTreeItem,
  GitStatus,
  FlattenedItem,
} from "@/lib/file-tree-helpers"
import {
  collectItems,
  filterVisibleItems,
  flattenEmptyDirectories,
  getStatusIndicator,
} from "@/lib/file-tree-helpers"

export type FileTreeDensity = "compact" | "default" | "relaxed"
export type FileTreeIconSet = "minimal" | "standard" | "complete"

export interface FileTreeProps {
  items: FileTreeItem[]
  flattenEmpty?: boolean
  searchable?: boolean
  gitStatus?: Record<string, GitStatus>
  density?: FileTreeDensity
  iconSet?: FileTreeIconSet
  defaultExpanded?: boolean
  className?: string
}

type DisplayItem = FlattenedItem & {
  id: string
  displayName: string
  isDirectory: boolean
  hasVisibleChildren: boolean
  parentId: string | null
}

const DENSITY_CLASSES: Record<
  FileTreeDensity,
  { row: string; icon: string; font: string; chevron: string }
> = {
  compact: {
    row: "py-0.5",
    icon: "size-3.5",
    font: "text-xs",
    chevron: "size-3.5",
  },
  default: {
    row: "py-1",
    icon: "size-4",
    font: "text-sm",
    chevron: "size-4",
  },
  relaxed: {
    row: "py-1.5",
    icon: "size-5",
    font: "text-base",
    chevron: "size-5",
  },
}

function fileIcon(name: string, iconSet: FileTreeIconSet) {
  if (iconSet === "minimal") return File
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase()
  if (ext === ".json") return FileJson
  if ([".md", ".mdx"].includes(ext)) return FileText
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".zig"].includes(ext))
    return FileCode2
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext))
    return ImageIcon
  return File
}

/** Infer a Shiki language hint from a filename when the item omits one. */
function inferLanguage(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase()
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    go: "go",
    rs: "rust",
    rb: "ruby",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    html: "html",
    css: "css",
    sql: "sql",
    toml: "toml",
    xml: "xml",
  }
  return map[ext] ?? "text"
}

function StatusBadge({
  status,
  density,
  reserveSpace,
}: {
  status: GitStatus | undefined
  density: FileTreeDensity
  reserveSpace?: boolean
}) {
  const indicator = getStatusIndicator(status)
  if (!indicator.label) {
    // Reserve the badge slot so rows align within git-aware trees.
    return reserveSpace ? (
      <span
        className={cn(
          "ml-auto inline-block",
          density === "compact" && "size-3.5",
          density === "default" && "size-4",
          density === "relaxed" && "size-4.5"
        )}
        aria-hidden="true"
      />
    ) : null
  }

  const toneClasses = {
    muted: "bg-muted text-muted-foreground",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    olive: "bg-olive/15 text-olive",
    rust: "bg-rust/15 text-rust",
    clay: "bg-clay/15 text-clay-dark",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  }

  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center justify-center rounded font-mono text-[10px] font-bold leading-none",
        density === "compact" && "size-3.5",
        density === "default" && "size-4",
        density === "relaxed" && "size-4.5",
        toneClasses[indicator.tone]
      )}
      aria-label={`status ${status?.status ?? "unchanged"}`}
    >
      {indicator.label}
    </span>
  )
}

export function FileTree({
  items,
  flattenEmpty = true,
  searchable = false,
  gitStatus,
  density = "default",
  iconSet = "standard",
  defaultExpanded = true,
  className,
}: FileTreeProps) {
  const [query, setQuery] = React.useState("")
  const flatItems = React.useMemo(() => {
    return flattenEmpty ? flattenEmptyDirectories(items) : collectItems(items)
  }, [items, flattenEmpty])

  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const set = new Set<string>()
    for (const item of flatItems) {
      const children = item.children ?? []
      const isDirectory = item.type === "directory" || children.length > 0
      if (isDirectory && defaultExpanded) {
        set.add(item.path)
      }
    }
    return set
  })

  const visiblePaths = React.useMemo(() => {
    return filterVisibleItems(flatItems, query)
  }, [flatItems, query])

  const focusedRef = React.useRef<HTMLDivElement | null>(null)
  const [focusedPath, setFocusedPath] = React.useState<string | null>(null)
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)

  const selectedItem = React.useMemo(
    () => (selectedPath ? flatItems.find((i) => i.path === selectedPath) : null),
    [flatItems, selectedPath]
  )

  const displayItems = React.useMemo(() => {
    const byPath = new Map<string, DisplayItem>()
    const visible: DisplayItem[] = []

    for (const item of flatItems) {
      const children = item.children ?? []
      const isDirectory = item.type === "directory" || children.length > 0
      const parentPath = item.path.includes("/")
        ? item.path.slice(0, item.path.lastIndexOf("/"))
        : null
      const parentId = parentPath ?? null

      const displayItem: DisplayItem = {
        ...item,
        id: item.path,
        displayName: item.flattenedName ?? item.name,
        isDirectory,
        hasVisibleChildren: isDirectory && children.length > 0,
        parentId: parentId,
      }

      byPath.set(item.path, displayItem)
      if (visiblePaths.has(item.path)) {
        visible.push(displayItem)
      }
    }

    // Prune children of collapsed directories unless they match search.
    return visible.filter((item) => {
      if (!item.parentId) return true
      if (!expanded.has(item.parentId) && query === "") return false
      return visiblePaths.has(item.parentId)
    })
  }, [flatItems, visiblePaths, expanded, query])

  const focusableItems = React.useMemo(() => {
    return displayItems.filter((item) => {
      // Directories are always focusable; files are focusable if visible.
      if (item.isDirectory) return true
      return visiblePaths.has(item.path)
    })
  }, [displayItems, visiblePaths])

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const focusIndex = React.useCallback(
    (index: number) => {
      const item = focusableItems[index]
      if (!item) return
      setFocusedPath(item.path)
      const el = document.querySelector<HTMLDivElement>(`[data-tree-path="${CSS.escape(item.path)}"]`)
      el?.focus()
    },
    [focusableItems]
  )

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (focusableItems.length === 0) return
    const currentIndex = focusedPath
      ? Math.max(
          0,
          focusableItems.findIndex((i) => i.path === focusedPath)
        )
      : 0

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        focusIndex(Math.min(currentIndex + 1, focusableItems.length - 1))
        break
      case "ArrowUp":
        event.preventDefault()
        focusIndex(Math.max(currentIndex - 1, 0))
        break
      case "ArrowRight": {
        event.preventDefault()
        const current = focusableItems[currentIndex]
        if (current?.isDirectory && !expanded.has(current.path)) {
          toggleExpanded(current.path)
        } else if (current?.isDirectory && expanded.has(current.path)) {
          const next = focusableItems[currentIndex + 1]
          if (next?.parentId === current.path) focusIndex(currentIndex + 1)
        }
        break
      }
      case "ArrowLeft": {
        event.preventDefault()
        const current = focusableItems[currentIndex]
        if (current?.isDirectory && expanded.has(current.path)) {
          toggleExpanded(current.path)
        } else if (current?.parentId) {
          const parentIndex = focusableItems.findIndex(
            (i) => i.path === current.parentId
          )
          if (parentIndex >= 0) focusIndex(parentIndex)
        }
        break
      }
      case "Enter":
      case " ": {
        event.preventDefault()
        const current = focusableItems[currentIndex]
        if (current?.isDirectory) toggleExpanded(current.path)
        break
      }
      default: {
        // Type-ahead: jump to next item whose display name starts with the key.
        if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
          const char = event.key.toLowerCase()
          const nextIndex = focusableItems.findIndex(
            (item, idx) =>
              idx > currentIndex &&
              item.displayName.toLowerCase().startsWith(char)
          )
          if (nextIndex >= 0) focusIndex(nextIndex)
        }
      }
    }
  }

  const densityStyles = DENSITY_CLASSES[density]
  const reserveStatusSpace = Boolean(gitStatus)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {searchable && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      )}
      <div
        ref={focusedRef}
        role="tree"
        aria-label="File tree"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      >
        {displayItems.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            No matching files
          </div>
        ) : (
          displayItems.map((item, index) => {
            const status = gitStatus?.[item.path]
            const isExpanded = expanded.has(item.path)
            const FileIcon = fileIcon(item.name, iconSet)
            const Icon = item.isDirectory ? Folder : FileIcon
            const statusTone = getStatusIndicator(status).tone
            const isIgnored = status?.status === "ignored"

            const rowClasses = cn(
              "group flex w-full min-w-0 items-center gap-2 rounded-md px-2 text-foreground outline-none transition-colors",
              densityStyles.row,
              densityStyles.font,
              "hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-ring",
              isIgnored && "text-muted-foreground"
            )

            const iconClasses = cn(
              "shrink-0",
              densityStyles.icon,
              item.isDirectory
                ? "text-muted-foreground"
                : statusTone === "olive"
                  ? "text-olive"
                  : statusTone === "amber"
                    ? "text-amber-600 dark:text-amber-400"
                    : statusTone === "rust"
                      ? "text-rust"
                      : statusTone === "clay"
                        ? "text-clay-dark"
                        : "text-muted-foreground"
            )

            if (item.isDirectory) {
              return (
                <div
                  key={item.id}
                  role="treeitem"
                  aria-level={item.depth + 1}
                  aria-posinset={index + 1}
                  aria-setsize={displayItems.length}
                  aria-selected={focusedPath === item.path ? "true" : "false"}
                  aria-expanded={isExpanded}
                  data-tree-path={item.path}
                  tabIndex={focusedPath === item.path ? 0 : -1}
                  onFocus={() => setFocusedPath(item.path)}
                  style={{ paddingLeft: `${item.depth * 1.25 + 0.5}rem` }}
                >
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(item.path)}
                  >
                    <CollapsibleTrigger
                      className={cn(
                        rowClasses,
                        "cursor-pointer group flex w-full min-w-0 items-center gap-2 rounded-md px-2 text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
                      )}
                    >
                        <ChevronRight
                          className={cn(
                            "shrink-0 text-muted-foreground transition-transform",
                            densityStyles.chevron,
                            isExpanded && "rotate-90"
                          )}
                        />
                        <Icon className={iconClasses} />
                        <span className="truncate">{item.displayName}</span>
                        <StatusBadge status={status} density={density} reserveSpace={reserveStatusSpace} />
                      </CollapsibleTrigger>
                    <CollapsibleContent>
                      {/* children rendered by the flat displayItems list */}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )
            }

            const hasContent = typeof item.content === "string"
            const isSelected = selectedPath === item.path
            const fileRowClasses = cn(
              rowClasses,
              hasContent &&
                "cursor-pointer select-none ring-inset",
              hasContent && isSelected &&
                "bg-primary/10 text-foreground ring-1 ring-primary/30",
              !hasContent && "cursor-default"
            )

            const handleFileActivate = () => {
              if (!hasContent) return
              setSelectedPath(isSelected ? null : item.path)
            }

            return (
              <div
                key={item.id}
                role="treeitem"
                aria-level={item.depth + 1}
                aria-posinset={index + 1}
                aria-setsize={displayItems.length}
                aria-selected={focusedPath === item.path ? "true" : "false"}
                data-tree-path={item.path}
                tabIndex={focusedPath === item.path ? 0 : -1}
                onFocus={() => setFocusedPath(item.path)}
                onClick={handleFileActivate}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleFileActivate()
                  }
                }}
                className={fileRowClasses}
                style={{
                  paddingLeft: `${item.depth * 1.25 + 0.5}rem`,
                }}
              >
                <Icon className={iconClasses} />
                <span className="truncate">{item.displayName}</span>
                <StatusBadge status={status} density={density} reserveSpace={reserveStatusSpace} />
              </div>
            )
          })
        )}
      </div>
      {selectedItem && typeof selectedItem.content === "string" && (
        <CodeBlock
          code={selectedItem.content}
          language={selectedItem.language ?? inferLanguage(selectedItem.name)}
          title={selectedItem.flattenedName ?? selectedItem.name}
          className="mt-2"
        />
      )}
    </div>
  )
}
