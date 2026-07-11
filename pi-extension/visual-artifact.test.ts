import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

import visualArtifactExtension, { artifactSpecFromParams } from "./visual-artifact"

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

describe("Pi package", () => {
  test("declares the extension and skill in the root manifest", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

    expect(pkg.keywords).toContain("pi-package")
    expect(pkg.peerDependencies).toEqual({ "@earendil-works/pi-coding-agent": "*" })
    expect(pkg.pi).toEqual({
      extensions: ["./pi-extension/visual-artifact.ts"],
      skills: ["./skill"],
    })
  })

  test("lets the package own skill discovery", () => {
    const events: string[] = []
    const commands: string[] = []
    const tools: string[] = []
    const pi = {
      on: (event: string) => events.push(event),
      registerCommand: (name: string) => commands.push(name),
      registerTool: (tool: { name: string }) => tools.push(tool.name),
    }

    visualArtifactExtension(pi as never)

    expect(events).not.toContain("resources_discover")
    expect(commands).toEqual(["visual-diff", "visual-recap"])
    expect(tools).toEqual(["create_visual_artifact"])
  })
})
