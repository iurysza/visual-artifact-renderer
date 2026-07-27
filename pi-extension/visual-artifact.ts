import { execSync, spawnSync } from "node:child_process"
import { resolve } from "node:path"
import os from "node:os"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

function findCli(): string | null {
  try {
    return execSync("command -v visual-artifact", { encoding: "utf8", timeout: 3000 }).trim()
  } catch {
    const fallbacks = [
      resolve(os.homedir(), ".local", "bin", "visual-artifact"),
      resolve(os.homedir(), ".pi", "bin", "visual-artifact"),
    ]
    for (const fallback of fallbacks) {
      try {
        execSync(`test -x ${fallback}`, { timeout: 1000 })
        return fallback
      } catch {
        // try next fallback
      }
    }
    return null
  }
}

export function artifactSpecFromParams(params: Record<string, unknown>): Record<string, unknown> {
  const { projectPath: _projectPath, directionInstruction: _directionInstruction, ...spec } = params
  return spec
}

interface ArtifactDirection {
  title: string
  description: string
  instruction: string
}

interface ArtifactDirectionDetails {
  question: string
  directions: ArtifactDirection[]
  selected: ArtifactDirection | { title: "Custom"; description: string; instruction: string } | null
  cancelled: boolean
}

const artifactDirectionSchema = {
  type: "object",
  properties: {
    question: { type: "string", description: "Question that frames the visual direction decision" },
    directions: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      description: "Two to four distinct visual/narrative directions for the requested artifact",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short direction title shown in the picker" },
          description: { type: "string", description: "One-sentence explanation of what the artifact will emphasize" },
          instruction: { type: "string", minLength: 1, description: "Concrete generation instruction to apply after selection" },
        },
        required: ["title", "description", "instruction"],
      },
    },
  },
  required: ["question", "directions"],
} as any

export function visualDiffRequest(scope: string, cwd: string): string {
  return (
    `Run a visual diff review for this repo.\n\n` +
    `Scope: ${scope}\n` +
    `Working directory: ${cwd}\n\n` +
    `Use the visual-artifact skill and follow its code-review reference. Gather git data; inspect changed files plus relevant callers, entrypoints, dependencies, and tests. ` +
    `When the change has a meaningful behavior path—or the review mainly concerns API shape, interfaces, types, and boundaries—add an execution-trace derived from source without running the program. Prioritize boundary events and type definitions; use inferred/static-analysis provenance, symbolic unknown values, and derived fixture examples with source notes. ` +
    `Never claim runtime capture, timings, or branch outcomes that static evidence cannot prove. Omit the trace when it would be decorative. ` +
    `Then call create_visual_artifact with the diff-review artifact and return its URL.`
  )
}

function runCreate(cli: string, spec: Record<string, unknown>, projectPath: string): { ok: boolean; output?: any; error?: string } {
  const result = spawnSync(cli, ["create", "-", "--project", projectPath, "--json"], {
    input: `${JSON.stringify(spec)}\n`,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout || "visual-artifact create failed" }
  }

  try {
    return { ok: true, output: JSON.parse(result.stdout) }
  } catch {
    return { ok: false, error: `Could not parse CLI output: ${result.stdout}` }
  }
}

export default function visualArtifactExtension(pi: ExtensionAPI) {
  let selectedDirection: ArtifactDirectionDetails["selected"] = null

  pi.on("before_agent_start", () => {
    selectedDirection = null
  })

  pi.on("tool_result", (event) => {
    if (event.toolName !== "choose_visual_artifact_direction") return

    const details = event.details as Partial<ArtifactDirectionDetails> | undefined
    const selected = details?.cancelled === false ? details.selected : null
    selectedDirection = selected?.instruction?.trim() ? selected : null
  })

  pi.on("tool_call", (event) => {
    if (event.toolName !== "create_visual_artifact") return

    if (!selectedDirection) {
      return {
        block: true,
        reason: "Choose an artifact direction with choose_visual_artifact_direction before creating an artifact.",
      }
    }

    if (event.input.directionInstruction !== selectedDirection.instruction) {
      return {
        block: true,
        reason: "Pass the exact selected instruction as directionInstruction when creating the artifact.",
      }
    }
  })

  pi.registerTool({
    name: "choose_visual_artifact_direction",
    label: "Choose Visual Artifact Direction",
    description: "Ask the user to choose the narrative and visual direction before generating a visual artifact.",
    promptSnippet: "Ask the user to choose an artifact direction before generating a requested visual artifact.",
    promptGuidelines: [
      "Before creating a user-requested visual artifact, call choose_visual_artifact_direction exactly once with 2–4 distinct directions tailored to the request. Do this before inspecting sources or building the spec.",
      "Use the selected instruction from choose_visual_artifact_direction as a binding generation constraint; do not replace it with an unselected direction. Pass that exact text as directionInstruction to create_visual_artifact.",
      "If choose_visual_artifact_direction reports a cancellation or unavailable UI, do not create the artifact; ask the user for a direction in chat instead.",
    ],
    parameters: artifactDirectionSchema,
    executionMode: "sequential",
    async execute(
      _toolCallId: string,
      params: { question: string; directions: ArtifactDirection[] },
      signal: AbortSignal | undefined,
      _onUpdate: (update: { type: string; text: string }) => void,
      ctx: { hasUI?: boolean; ui: { select: (title: string, options: string[], options?: { signal?: AbortSignal }) => Promise<string | undefined>; input: (title: string, placeholder?: string, options?: { signal?: AbortSignal }) => Promise<string | undefined> } },
    ) {
      const details = (selected: ArtifactDirectionDetails["selected"], cancelled: boolean): ArtifactDirectionDetails => ({
        question: params.question,
        directions: params.directions,
        selected,
        cancelled,
      })

      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: "Artifact direction was not chosen because interactive UI is unavailable. Ask the user in chat and wait." }],
          details: details(null, true),
        }
      }

      const customLabel = "Other direction…"
      const choice = await ctx.ui.select(
        params.question,
        [...params.directions.map((direction) => `${direction.title} — ${direction.description}`), customLabel],
        { signal },
      )

      if (!choice) {
        return {
          content: [{ type: "text", text: "User cancelled artifact direction selection." }],
          details: details(null, true),
        }
      }

      if (choice === customLabel) {
        const instruction = (await ctx.ui.input("Artifact direction", "Describe what the artifact should emphasize", { signal }))?.trim()
        if (!instruction) {
          return {
            content: [{ type: "text", text: "User cancelled custom artifact direction." }],
            details: details(null, true),
          }
        }

        const selected = { title: "Custom" as const, description: instruction, instruction }
        return {
          content: [{ type: "text", text: `User chose custom artifact direction: ${instruction}` }],
          details: details(selected, false),
        }
      }

      const selected = params.directions.find(
        (direction) => `${direction.title} — ${direction.description}` === choice,
      )
      if (!selected) {
        throw new Error("Artifact direction picker returned an unknown option")
      }

      return {
        content: [{ type: "text", text: `User chose artifact direction: ${selected.title}\nInstruction: ${selected.instruction}` }],
        details: details(selected, false),
      }
    },
  })

  pi.registerCommand("visual-diff", {
    description: "Generate a visual diff review as a visual artifact.",
    argumentHint: "[branch|commit|range|#PR|HEAD]",
    handler: async (args, ctx) => {
      const scope = args.trim() || "main"
      await pi.sendUserMessage(visualDiffRequest(scope, ctx.cwd))
    },
  })

  pi.registerCommand("visual-recap", {
    description: "Generate a visual project recap.",
    argumentHint: "[time-window]",
    handler: async (args, ctx) => {
      const window = args.trim() || "2 weeks"
      await pi.sendUserMessage(
        `Generate a visual project recap for ${ctx.cwd}.\n\n` +
        `Time window: ${window}\n\n` +
        `Use the visual-artifact skill. Gather project identity, recent commits, changed files, and TODO/FIXME comments, ` +
        `then call create_visual_artifact with a recap artifact. Return the artifact URL.`,
      )
    },
  })

  pi.registerTool({
    name: "create_visual_artifact",
    label: "Create Visual Artifact",
    description: "Validate and save a visual artifact JSON spec via the visual-artifact CLI, then return its URL.",
    promptSnippet: "Create a polished visual artifact from any Pi session; save it via the CLI and return the URL.",
    promptGuidelines: [
      "For codebase visual artifacts, use the visual-artifact skill pipeline first, then call create_visual_artifact with the spec.",
      "For simple visual artifacts, call create_visual_artifact directly with a JSON spec after choosing a direction.",
      "Set directionInstruction to the exact instruction returned by choose_visual_artifact_direction; it is an extension-only field and is not persisted in the artifact spec.",
      "Run `visual-artifact contract` and only use supported node types, props, and resource limits.",
      "Always classify the artifact with exactly one artifactType and 2–5 concise lowercase kebab-case topics.",
      "Do not generate standalone HTML, JSX, React components, routes, imports, or CSS; emit a constrained JSON spec and call create_visual_artifact.",
      "The Pi tool never grants `--allow-read`; file-tree `src` values must resolve inside the canonical project root. Prefer inline `content` when the source is outside it.",
      "The CLI validates the spec, writes an artifact bundle, and auto-starts the renderer if needed.",
    ],
    parameters: {
      type: "object",
      properties: {
        slug: { type: "string", description: "kebab-case artifact slug. Example: revenue-dashboard" },
        title: { type: "string", description: "Artifact title" },
        description: { type: "string", description: "Short artifact description" },
        artifactType: {
          type: "string",
          enum: ["explainer", "dashboard", "review", "comparison", "report", "plan", "diagram", "idea"],
          description: "Required closed classification used for artifact discovery.",
        },
        topics: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          uniqueItems: true,
          items: {
            type: "string",
            minLength: 1,
            maxLength: 40,
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          },
          description: "Required searchable topics: 2–5 concise lowercase kebab-case values.",
        },
        layout: { type: "object", description: "Layout options" },
        projectPath: { type: "string", description: "Directory to derive the project name from. Defaults to caller's cwd." },
        directionInstruction: { type: "string", minLength: 1, description: "Exact instruction returned by choose_visual_artifact_direction; used only to bind this creation to the selected direction." },
        data: { type: "object", description: "Embedded datasets. Max 20 datasets." },
        nodes: { type: "array", description: "ArtifactNode[]. Max 30 nodes." },
      },
      required: ["slug", "title", "artifactType", "topics", "nodes", "directionInstruction"],
    } as any,
    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
      _signal: AbortSignal,
      _onUpdate: (update: { type: string; text: string }) => void,
      ctx: { cwd?: string },
    ) {
      const cli = findCli()
      if (!cli) {
        throw new Error("visual-artifact CLI not found in PATH. Install the visual-artifact skill.")
      }

      const projectPath = params.projectPath ? resolve(String(params.projectPath)) : resolve(ctx.cwd ?? ".")
      const result = runCreate(cli, artifactSpecFromParams(params), projectPath)

      if (!result.ok) {
        throw new Error(result.error)
      }

      const { slug, projectName, path: filePath, url } = result.output
      return {
        content: [{ type: "text", text: `Created visual artifact ${slug} in project ${projectName}. Open ${url}` }],
        details: { slug, projectName, projectPath, path: filePath, url },
      }
    },
  })
}
