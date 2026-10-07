import assert from "node:assert/strict"
import { test } from "node:test"
import { flattenEmptyDirectories } from "./file-tree-helpers"

test("collapsed directory chain prefixes only the head row, not its descendants", () => {
  const rows = flattenEmptyDirectories([
    { name: "cli", type: "directory", children: [
      { name: "src", type: "directory", children: [
        { name: "commands", type: "directory", children: [
          { name: "create.ts", type: "file" },
          { name: "create.test.ts", type: "file" },
        ] },
      ] },
    ] },
  ])
  assert.deepEqual(
    rows.map((row) => [row.flattenedName ?? row.name, row.path]),
    [
      ["cli/src/commands", "cli/src/commands"],
      ["create.ts", "cli/src/commands/create.ts"],
      ["create.test.ts", "cli/src/commands/create.test.ts"],
    ],
  )
})
