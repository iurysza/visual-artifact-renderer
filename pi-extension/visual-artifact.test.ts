import { describe, expect, test } from "bun:test"

import { artifactSpecFromParams } from "./visual-artifact"

describe("artifactSpecFromParams", () => {
  test("keeps artifact fields and strips routing-only projectPath", () => {
    expect(
      artifactSpecFromParams({
        slug: "demo",
        title: "Demo",
        projectPath: "/tmp/project",
        nodes: [{ type: "text", props: { text: "Hello" } }],
      }),
    ).toEqual({
      slug: "demo",
      title: "Demo",
      nodes: [{ type: "text", props: { text: "Hello" } }],
    })
  })
})
