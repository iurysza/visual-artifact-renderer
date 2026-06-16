"use client"

import { ChevronRight, File, Folder } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible"

export interface FileTreeItem {
  name: string
  type?: "file" | "directory"
  children?: FileTreeItem[]
}

export interface FileTreeProps {
  items: FileTreeItem[]
  className?: string
}

function FileTreeNode({ item, depth = 0 }: { item: FileTreeItem; depth?: number }) {
  const isDirectory = item.type === "directory" || (item.children && item.children.length > 0)
  const children = item.children ?? []

  if (!isDirectory) {
    return (
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground hover:bg-muted"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        <File className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{item.name}</span>
      </div>
    )
  }

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{item.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col">
          {children.map((child, index) => (
            <FileTreeNode key={index} item={child} depth={depth + 1} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function FileTree({ items, className }: FileTreeProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {items.map((item, index) => (
        <FileTreeNode key={index} item={item} />
      ))}
    </div>
  )
}

export { FileTree }
