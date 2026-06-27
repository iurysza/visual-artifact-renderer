import { execSync, spawnSync } from "node:child_process"
import { resolve } from "node:path"
import os from "node:os"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const SKILL_PATH = resolve(os.homedir(), ".pi", "skills", "visual-artifact", "SKILL.md")

function findCli(): string | null {
  try {
    return execSync("command -v visual-artifact", { encoding: "utf8", timeout: 3000 }).trim()
  } catch {
    const fallback = resolve(os.homedir(), ".pi", "bin", "visual-artifact")
    try {
      execSync(`test -x ${fallback}`, { timeout: 1000 })
      return fallback
    } catch {
      return null
    }
  }
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
  pi.on("resources_discover", () => {
    return { skillPaths: [SKILL_PATH] }
  })

  pi.registerCommand("visual-diff", {
    description: "Generate a visual diff review as a visual artifact.",
    argumentHint: "[branch|commit|range|#PR|HEAD]",
    handler: async (args, ctx) => {
      const scope = args.trim() || "main"
      await pi.sendUserMessage(
        `Run a visual diff review for this repo.\n\n` +
        `Scope: ${scope}\n` +
        `Working directory: ${ctx.cwd}\n\n` +
        `Use the visual-artifact skill. Gather git data, inspect changed files, ` +
        `then call create_visual_artifact with a diff-review artifact. Return the artifact URL.`,
      )
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
      "For simple visual artifacts, call create_visual_artifact directly with a JSON spec.",
      "Read artifact-contract.json from the visual-artifact skill folder and only use supported node types and props.",
      "Do not generate standalone HTML, JSX, React components, routes, imports, or CSS; emit a constrained JSON spec and call create_visual_artifact.",
      "The CLI validates the spec, writes it to the skill artifacts folder, and auto-starts the renderer if needed.",
    ],
    parameters: {
      type: "object",
      properties: {
        slug: { type: "string", description: "kebab-case artifact slug. Example: revenue-dashboard" },
        title: { type: "string", description: "Artifact title" },
        description: { type: "string", description: "Short artifact description" },
        layout: { type: "object", description: "Layout options" },
        projectPath: { type: "string", description: "Directory to derive the project name from. Defaults to caller's cwd." },
        data: { type: "object", description: "Embedded datasets. Max 20 datasets." },
        nodes: { type: "array", description: "ArtifactNode[]. Max 30 nodes." },
      },
      required: ["slug", "title", "nodes"],
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
      const result = runCreate(cli, params, projectPath)

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
