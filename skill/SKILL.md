---
name: visual-artifact
description: Use when the user wants a rendered visual artifact from code or data.
---

# visual-artifact

Use this skill when the user wants a rendered visual artifact from code or data.

## When to use this skill

Use it for requests like:

- "generate a visual artifact"
- "diagram this project"
- "visual summary of the repo"
- "create a dashboard"
- "build a component gallery"
- "explain this with a diagram"
- any request that ends with a rendered artifact page

## When NOT to use this skill

- For plain text reports, summaries, or markdown docs that don't need rendering.
- For code generation, tests, or refactors.

## Choose a route

| Request | Route |
|---|---|
| Comprehensive architecture documentation; full codebase architecture overview; system design docs | [[references/architecture-overview/_index\|architecture overview]] |
| Component galleries, feature explainers, dashboards, quick diagrams, visual summaries of a subset | [[references/direct-artifact/_index\|direct artifact]] |

**Default to direct artifact.** Only use the architecture overview flow when the user explicitly wants comprehensive, repo-wide architecture documentation.

## Router: choose the right path

### Architecture overview (full pipeline)

Use ONLY for comprehensive architecture documentation — full system architecture, container diagrams, end-to-end data flows, module relationships across the whole repo.

Start here: [[references/architecture-overview/_index\|architecture overview]].

### Direct artifact (default)

Use for component galleries, feature explainers, dashboards, quick diagrams, visual summaries of a specific area, or any artifact where you can build the spec directly from known data.

Start here: [[references/direct-artifact/_index\|direct artifact]].

## The `visual-artifact` CLI

This skill is self-contained: it ships a fast, compiled Bun CLI and a Next.js renderer app, all under the skill directory.

```text
~/.agents/skills/visual-artifact/
  SKILL.md            # this file
  artifact-contract.json
  cli/                # Bun CLI source
  app/                # Next.js renderer (source + out/ after build)
  artifacts/          # generated artifact JSON files
  references/         # usage guides
```

After the skill is installed, the binary is available globally as `visual-artifact`.

### Installation

From the agents repo root:

```sh
./install.sh --apply
```

The installer symlinks the skill directory into `~/.agents/skills/visual-artifact` and runs `visual-artifact bootstrap`, which installs dependencies, builds the renderer app, compiles the CLI, and symlinks `visual-artifact` into `~/.pi/bin/`.

You can also bootstrap directly from the skill directory:

```sh
cd ~/.agents/skills/visual-artifact/cli
bun run src/main.ts bootstrap
```

Or, once the binary is installed:

```sh
visual-artifact bootstrap
```

### Commands

```text
visual-artifact [global flags] <command>

global flags:
  -h, --help       Show help
  --version        Print version
  --json           Machine-readable JSON output
  --plain          Stable line-based text output
  -q, --quiet      Suppress non-essential output
  -v, --verbose    Show more detail
  --no-color       Disable colored output
  --no-input       Never prompt for input
```

| Command | Usage | What it does |
|---|---|---|
| `bootstrap` | `visual-artifact bootstrap [--dry-run]` | Build the renderer, compile the CLI, and install the binary. |
| `create` | `visual-artifact create [spec.json]` | Validate, save, and auto-start the renderer if needed. Reads from file or stdin. |
| `validate` | `visual-artifact validate [spec.json]` | Validate a spec without writing it. |
| `serve` | `visual-artifact serve [--port] [--host] [--no-open]` | Start the renderer server. Default host is `0.0.0.0`. |
| `serve status` | `visual-artifact serve status` | Check whether the renderer server is running. |
| `serve stop` | `visual-artifact serve stop` | Stop the renderer server if it is tracked. If the server was started outside the CLI (e.g. tmux), stop it manually or via the tmux session. |
| `list` | `visual-artifact list [project]` | List projects or artifacts in a project. |
| `open` | `visual-artifact open <project>/<slug>` | Open an artifact in the browser. |
| `doctor` | `visual-artifact doctor` | Run health checks. |

### Examples

```sh
# Create from a file. The renderer starts automatically in the background if it is not running.
visual-artifact create my-spec.json

# Create from stdin
cat my-spec.json | visual-artifact create

# Validate a spec
visual-artifact validate my-spec.json

# Start the server in the background on all interfaces, don't open a browser
visual-artifact serve --no-open

# Or start it inside tmux so it survives the Pi session
#   tmux new-session -d -s visual-artifact "visual-artifact serve --no-open"

# Open a specific artifact
visual-artifact open my-project/my-slug

# Check health
visual-artifact doctor
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `VISUAL_ARTIFACT_ARTIFACTS_DIR` | `<skill>/artifacts` | Where artifact JSON files are stored. |
| `VISUAL_ARTIFACT_OUT_DIR` | `<skill>/app/out` | Static renderer assets. |
| `VISUAL_ARTIFACT_PORT` | `9999` | Server port. |
| `VISUAL_ARTIFACT_HOST` | `0.0.0.0` | Server host. Binds on all interfaces so the server is reachable on both localhost and the LAN IP. |
| `VISUAL_ARTIFACT_MOUNT_PATH` | `/artifacts` | URL mount path. |
| `VISUAL_ARTIFACT_DATA_PATH` | `/data/artifacts` | Data API path. |
| `VISUAL_ARTIFACT_BASE_URL` | — | Preferred base URL for artifact links. |

## Slash commands

When the visual-artifact extension is installed, these slash commands are available:

| Command | Usage | What it does |
|---|---|---|
| `/visual-diff` | `/visual-diff [branch\|commit\|range\|#PR\|HEAD]` | Generates a visual diff review as a visual artifact. Defaults to `main` when no argument is given. |
| `/visual-recap` | `/visual-recap [2w\|30d\|3m]` | Generates a visual project recap — current state, recent decisions, and cognitive debt hotspots. Defaults to `2w` when no argument is given. |

## Critical rules

- **Never call `create_visual_artifact` from inside a `pi --print` subprocess.** The assembler writes JSON to disk; the parent agent calls the tool.
- **Always pass the `data` object** when calling `create_visual_artifact`.
- **The CLI validates specs for you.** If the JSON is malformed, misses required fields (`slug`, `title`, `nodes`), uses an unsupported node type, or breaks size limits, `visual-artifact create`/`validate` exits with code 2 and prints a clear error.
- **Before calling `create_visual_artifact`, read `~/.agents/skills/visual-artifact/artifact-contract.json`** and only use supported node types and props.
- **The CLI auto-manages the renderer.** `visual-artifact create` starts the renderer in the background if it is not already running. You can also start it explicitly with `visual-artifact serve`.
- **Artifacts live in the skill folder.** `visual-artifact create` writes to `<skill>/artifacts/<project>/<slug>.json`. Do not write `~/.pi/artifacts/<project>/<slug>.json` directly unless you are bypassing the CLI.
- **Use the CLI to create artifacts.** Prefer `visual-artifact create <spec.json>` (or pipe JSON to stdin) over writing JSON directly, because the CLI validates against the contract and derives the project name automatically.
- **Orientation-first for architecture docs:** answer "what is this project?" before recommendations.

## Design guidelines (required reading)

Read [[references/design-guidelines|design guidelines]] before building any artifact. It covers how to structure content, choose node types, avoid generic output, and keep every artifact focused on its topic.

For concrete patterns by content type, see [[references/content-types/_index|content types]].
