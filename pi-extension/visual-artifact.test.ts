import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

import visualArtifactExtension, { artifactSpecFromParams, visualDiffRequest } from "./visual-artifact"

describe("artifactSpecFromParams", () => {
  test("keeps artifact fields and strips routing-only projectPath", () => {
    expect(
      artifactSpecFromParams({
        slug: "demo",
        title: "Demo",
        artifactType: "explainer",
        topics: ["runtime", "testing"],
        projectPath: "/tmp/project",
        nodes: [{ type: "text", props: { text: "Hello" } }],
      }),
    ).toEqual({
      slug: "demo",
      title: "Demo",
      artifactType: "explainer",
      topics: ["runtime", "testing"],
      nodes: [{ type: "text", props: { text: "Hello" } }],
    })
  })
})

describe("visualDiffRequest", () => {
  test("requests an evidence-honest static execution trace when useful", () => {
    const request = visualDiffRequest("HEAD", "/tmp/repo")

    expect(request).toContain("Scope: HEAD")
    expect(request).toContain("Working directory: /tmp/repo")
    expect(request).toContain("relevant callers, entrypoints, dependencies, and tests")
    expect(request).toContain("derived from source without running the program")
    expect(request).toContain("inferred/static-analysis provenance")
    expect(request).toContain("Omit the trace when it would be decorative")
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
    const tools: Array<{
      name: string
      promptGuidelines: string[]
      parameters: {
        required: string[]
        properties: Record<string, Record<string, unknown>>
      }
    }> = []
    const pi = {
      on: (event: string) => events.push(event),
      registerCommand: (name: string) => commands.push(name),
      registerTool: (tool: (typeof tools)[number]) => tools.push(tool),
    }

    visualArtifactExtension(pi as never)

    expect(events).not.toContain("resources_discover")
    expect(commands).toEqual(["visual-diff", "visual-recap"])
    expect(tools.map((tool) => tool.name)).toEqual(["create_visual_artifact"])

    const tool = tools[0]!
    expect(tool.parameters.required).toEqual(["slug", "title", "artifactType", "topics", "nodes"])
    expect(tool.parameters.properties.topics).toMatchObject({
      minItems: 2,
      maxItems: 5,
      uniqueItems: true,
    })
    expect(tool.promptGuidelines).toContain(
      "Always classify the artifact with exactly one artifactType and 2–5 concise lowercase kebab-case topics.",
    )
  })
})
