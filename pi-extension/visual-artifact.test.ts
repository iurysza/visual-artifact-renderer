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
        directionInstruction: "Lead with the implementation tradeoffs.",
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
      execute?: (...args: any[]) => Promise<any>
    }> = []
    const pi = {
      on: (event: string) => events.push(event),
      registerCommand: (name: string) => commands.push(name),
      registerTool: (tool: (typeof tools)[number]) => tools.push(tool),
    }

    visualArtifactExtension(pi as never)

    expect(events).not.toContain("resources_discover")
    expect(commands).toEqual(["visual-diff", "visual-recap"])
    expect(tools.map((tool) => tool.name)).toEqual(["choose_visual_artifact_direction", "create_visual_artifact"])

    const directionTool = tools[0]!
    expect(directionTool.parameters.required).toEqual(["question", "directions"])
    expect(directionTool.promptGuidelines).toContain(
      "Before creating a user-requested visual artifact, call choose_visual_artifact_direction exactly once with 2–4 distinct directions tailored to the request. Do this before inspecting sources or building the spec.",
    )

    const tool = tools[1]!
    expect(tool.parameters.required).toEqual(["slug", "title", "artifactType", "topics", "nodes", "directionInstruction"])
    expect(tool.parameters.properties.topics).toMatchObject({
      minItems: 2,
      maxItems: 5,
      uniqueItems: true,
    })
    expect(tool.promptGuidelines).toContain(
      "Always classify the artifact with exactly one artifactType and 2–5 concise lowercase kebab-case topics.",
    )
  })

  test("returns the selected direction as a generation instruction", async () => {
    const tools: Array<{ name: string; execute?: (...args: any[]) => Promise<any> }> = []
    const pi = {
      on: () => {},
      registerCommand: () => {},
      registerTool: (tool: (typeof tools)[number]) => tools.push(tool),
    }
    visualArtifactExtension(pi as never)

    const directionTool = tools.find((tool) => tool.name === "choose_visual_artifact_direction")!
    const direction = {
      title: "Evidence first",
      description: "Lead with verified facts and supporting detail.",
      instruction: "Use tables and source-backed evidence before narrative.",
    }
    let receivedSignal: AbortSignal | undefined
    const controller = new AbortController()
    const result = await directionTool.execute!(
      "tool-call",
      { question: "What direction?", directions: [direction, { ...direction, title: "Story first" }] },
      controller.signal,
      () => {},
      {
        hasUI: true,
        ui: {
          select: async (_title: string, _options: string[], options?: { signal?: AbortSignal }) => {
            receivedSignal = options?.signal
            return "Evidence first — Lead with verified facts and supporting detail."
          },
          input: async () => undefined,
        },
      },
    )

    expect(result.details).toMatchObject({ selected: direction, cancelled: false })
    expect(result.content[0].text).toContain(direction.instruction)
    expect(receivedSignal).toBe(controller.signal)
  })

  test("does not choose a direction without interactive UI", async () => {
    const tools: Array<{ name: string; execute?: (...args: any[]) => Promise<any> }> = []
    const pi = {
      on: () => {},
      registerCommand: () => {},
      registerTool: (tool: (typeof tools)[number]) => tools.push(tool),
    }
    visualArtifactExtension(pi as never)

    const result = await tools.find((tool) => tool.name === "choose_visual_artifact_direction")!.execute!(
      "tool-call",
      { question: "What direction?", directions: [] },
      new AbortController().signal,
      () => {},
      { hasUI: false, ui: { select: async () => undefined, input: async () => undefined } },
    )

    expect(result.details).toMatchObject({ selected: null, cancelled: true })
  })

  test("blocks artifact creation until a direction is selected", () => {
    const handlers = new Map<string, (event: any) => any>()
    const pi = {
      on: (event: string, handler: (event: any) => any) => handlers.set(event, handler),
      registerCommand: () => {},
      registerTool: () => {},
    }
    visualArtifactExtension(pi as never)

    handlers.get("before_agent_start")!({})
    expect(handlers.get("tool_call")!({ toolName: "create_visual_artifact" })).toMatchObject({
      block: true,
      reason: "Choose an artifact direction with choose_visual_artifact_direction before creating an artifact.",
    })

    handlers.get("tool_result")!({
      toolName: "choose_visual_artifact_direction",
      details: {
        cancelled: false,
        selected: { title: "Evidence first", description: "Use facts", instruction: "Lead with evidence." },
      },
    })
    expect(handlers.get("tool_call")!({ toolName: "create_visual_artifact", input: {} })).toMatchObject({
      block: true,
      reason: "Pass the exact selected instruction as directionInstruction when creating the artifact.",
    })
    expect(
      handlers.get("tool_call")!({
        toolName: "create_visual_artifact",
        input: { directionInstruction: "Lead with evidence." },
      }),
    ).toBeUndefined()

    handlers.get("before_agent_start")!({})
    handlers.get("tool_result")!({
      toolName: "choose_visual_artifact_direction",
      details: { cancelled: false, selected: { title: "Blank", description: "", instruction: "  " } },
    })
    expect(handlers.get("tool_call")!({ toolName: "create_visual_artifact", input: {} })).toMatchObject({
      block: true,
      reason: "Choose an artifact direction with choose_visual_artifact_direction before creating an artifact.",
    })
  })
})
