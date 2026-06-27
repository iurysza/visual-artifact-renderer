import * as React from "react"

import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

export type DiffProps = {
  before: string
  after: string
  language?: string
  title?: string
  defaultOpen?: boolean
  className?: string
}

type DiffLine = {
  type: "equal" | "remove" | "add"
  value: string
  oldLine?: number
  newLine?: number
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line, index, arr) => index !== arr.length - 1 || line !== "")
}

function computeDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length
  const m = b.length

  if (n === 0 && m === 0) {
    return []
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0)
  )

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const ops: {
    type: "equal" | "remove" | "add"
    oldIndex: number
    newIndex: number
  }[] = []

  let i = n
  let j = m

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: "equal", oldIndex: i - 1, newIndex: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "add", oldIndex: -1, newIndex: j - 1 })
      j--
    } else {
      ops.push({ type: "remove", oldIndex: i - 1, newIndex: -1 })
      i--
    }
  }

  ops.reverse()

  return ops.map((op) => {
    if (op.type === "equal") {
      return {
        type: "equal",
        value: a[op.oldIndex],
        oldLine: op.oldIndex + 1,
        newLine: op.newIndex + 1,
      }
    }

    if (op.type === "remove") {
      return {
        type: "remove",
        value: a[op.oldIndex],
        oldLine: op.oldIndex + 1,
      }
    }

    return {
      type: "add",
      value: b[op.newIndex],
      newLine: op.newIndex + 1,
    }
  })
}

export function Diff({
  before,
  after,
  language,
  title,
  defaultOpen = true,
  className,
}: DiffProps) {
  const lines = computeDiff(splitLines(before), splitLines(after))
  const added = lines.filter((line) => line.type === "add").length
  const removed = lines.filter((line) => line.type === "remove").length

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card
        data-slot="diff"
        className={cn("overflow-hidden", className)}
      >
        <CollapsibleTrigger
          render={
            <CardHeader className="flex cursor-pointer flex-row items-center justify-between gap-3 px-(--card-spacing) py-3 hover:bg-muted/30">
              <div className="flex min-w-0 items-center gap-3">
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                <CardTitle className="text-base font-medium">
                  {title ?? "Diff"}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {added > 0 && (
                    <Badge
                      variant="outline"
                      className="border-olive/30 bg-olive/10 text-olive"
                    >
                      +{added}
                    </Badge>
                  )}
                  {removed > 0 && (
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-destructive"
                    >
                      −{removed}
                    </Badge>
                  )}
                </div>
              </div>
              {language && (
                <Badge variant="outline" className="uppercase">
                  {language}
                </Badge>
              )}
            </CardHeader>
          }
        />
        <CollapsibleContent>
          <CardContent className="p-0">
            {lines.length === 0 ? (
              <div className="px-(--card-spacing) py-6 text-sm text-muted-foreground">
                No differences
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {lines.map((line, index) => (
                      <tr
                        key={index}
                        className={cn(
                          "font-mono",
                          line.type === "remove" &&
                            "bg-destructive/10 text-destructive",
                          line.type === "add" &&
                            "bg-olive/10 text-olive",
                          line.type === "equal" && "text-card-foreground"
                        )}
                      >
                        <td className="w-8 select-none px-2 py-1 text-center text-xs font-medium opacity-80">
                          {line.type === "remove" && "−"}
                          {line.type === "add" && "+"}
                        </td>
                        <td className="w-12 min-w-12 select-none px-2 py-1 text-right text-xs text-muted-foreground">
                          {line.oldLine}
                        </td>
                        <td className="w-12 min-w-12 select-none px-2 py-1 text-right text-xs text-muted-foreground">
                          {line.newLine}
                        </td>
                        <td className="w-full whitespace-pre px-3 py-1">
                          {line.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
