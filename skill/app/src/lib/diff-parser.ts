export type DiffLineType = "context" | "remove" | "add"

export type DiffLine = {
  type: DiffLineType
  value: string
  oldLine?: number
  newLine?: number
}

export type Hunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  header?: string
  lines: DiffLine[]
}

export type DiffFile = {
  oldPath: string
  newPath: string
  hunks: Hunk[]
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line, index, arr) => index !== arr.length - 1 || line !== "")
}

function parsePath(line: string): string {
  // e.g. "--- a/file.txt" or "--- file.txt\t2024-01-01 ..."
  const afterPrefix = line.slice(4)
  const tabIndex = afterPrefix.indexOf("\t")
  return tabIndex === -1 ? afterPrefix.trim() : afterPrefix.slice(0, tabIndex)
}

export function parseUnifiedDiff(content: string): DiffFile {
  const lines = splitLines(content)

  if (lines.length === 0) {
    return { oldPath: "", newPath: "", hunks: [] }
  }

  const hasDiffSyntax = lines.some(
    (line) =>
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("@@ ")
  )

  if (!hasDiffSyntax) {
    return {
      oldPath: "",
      newPath: "",
      hunks: [
        {
          oldStart: 1,
          oldLines: lines.length,
          newStart: 1,
          newLines: lines.length,
          lines: lines.map((line, index) => ({
            type: "context" as const,
            value: line,
            oldLine: index + 1,
            newLine: index + 1,
          })),
        },
      ],
    }
  }

  let oldPath = ""
  let newPath = ""
  const hunks: Hunk[] = []
  let currentHunk: Hunk | null = null
  let oldLine = 0
  let newLine = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith("--- ")) {
      oldPath = parsePath(line)
      continue
    }

    if (line.startsWith("+++ ")) {
      newPath = parsePath(line)
      continue
    }

    if (line.startsWith("@@ ")) {
      const match =
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line)
      if (match) {
        if (currentHunk) {
          hunks.push(currentHunk)
        }
        const oldStart = parseInt(match[1], 10)
        const oldLines = parseInt(match[2] ?? "1", 10)
        const newStart = parseInt(match[3], 10)
        const newLines = parseInt(match[4] ?? "1", 10)
        const header = match[5].trim() || undefined

        oldLine = oldStart
        newLine = newStart
        currentHunk = {
          oldStart,
          oldLines,
          newStart,
          newLines,
          header,
          lines: [],
        }
      }
      continue
    }

    if (!currentHunk) {
      continue
    }

    if (line === "\\ No newline at end of file") {
      continue
    }

    if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "remove",
        value: line.slice(1),
        oldLine: oldLine++,
      })
      continue
    }

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "add",
        value: line.slice(1),
        newLine: newLine++,
      })
      continue
    }

    // Context line (starts with space) or any other line treated as context.
    currentHunk.lines.push({
      type: "context",
      value: line.startsWith(" ") ? line.slice(1) : line,
      oldLine: oldLine++,
      newLine: newLine++,
    })
  }

  if (currentHunk) {
    hunks.push(currentHunk)
  }

  // If no hunks were found despite diff-like syntax, fall back to context.
  if (hunks.length === 0) {
    return {
      oldPath,
      newPath,
      hunks: [
        {
          oldStart: 1,
          oldLines: lines.length,
          newStart: 1,
          newLines: lines.length,
          lines: lines.map((line, index) => ({
            type: "context" as const,
            value: line,
            oldLine: index + 1,
            newLine: index + 1,
          })),
        },
      ],
    }
  }

  return { oldPath, newPath, hunks }
}
