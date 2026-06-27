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

This skill ships a fast, compiled Bun CLI. After the skill is installed, the binary is available globally as `visual-artifact`.

### Installation

From the agents repo root:

```sh
./install.sh --apply
```

This builds the CLI and links it into `~/.pi/bin/visual-artifact`.

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
| `create` | `visual-artifact create [spec.json]` | Validate and save an artifact spec. Reads from file or stdin. |
| `validate` | `visual-artifact validate [spec.json]` | Validate a spec without writing it. |
| `serve` | `visual-artifact serve [--port] [--host] [--no-open]` | Start the renderer server. Default host is `0.0.0.0`. |
| `serve status` | `visual-artifact serve status` | Check whether the renderer server is running. |
| `serve stop` | `visual-artifact serve stop` | Stop the renderer server if it is tracked. If the server was started outside the CLI (e.g. tmux), stop it manually or via the tmux session.
| `list` | `visual-artifact list [project]` | List projects or artifacts in a project. |
| `open` | `visual-artifact open <project>/<slug>` | Open an artifact in the browser. |
| `doctor` | `visual-artifact doctor` | Run health checks. |
| `share status` | `visual-artifact share status` | Show Tailscale + renderer status (Tailscale optional). |
| `share url` | `visual-artifact share url [project] [slug]` | Print the tailnet URL if Tailscale is available. |
| `share setup` | `visual-artifact share setup --dry-run` | Print the `tailscale serve` command; run with `--force`. |

### Examples

```sh
# Create from a file
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
| `VISUAL_ARTIFACT_ARTIFACTS_DIR` | `~/.pi/artifacts` | Where artifact JSON files are stored. |
| `VISUAL_ARTIFACT_OUT_DIR` | `~/.pi/tools/visual-artifact/out` | Static renderer assets. |
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
- **Before calling `create_visual_artifact`, read `~/.pi/tools/visualizer/artifact-contract.json`** and only use supported node types and props.
- **Keep the renderer running** with `visual-artifact serve` before calling `create_visual_artifact` if you want the artifact URL to resolve locally. The default server binds to `0.0.0.0:9999`, so it is reachable on `http://127.0.0.1:9999/artifacts` and on the machine's LAN IP.
- **Use the CLI to create artifacts.** Prefer `visual-artifact create <spec.json>` (or pipe JSON to stdin) over writing `~/.pi/artifacts/<project>/<slug>.json` directly, because the CLI validates against the embedded contract and derives the project name automatically.
- **Orientation-first for architecture docs:** answer "what is this project?" before recommendations.

## Design guidelines (required reading)

Read [[references/design-guidelines|design guidelines]] before building any artifact. It covers how to structure content, choose node types, avoid generic output, and keep every artifact focused on its topic.

For concrete patterns by content type, see [[references/content-types/_index|content types]].
