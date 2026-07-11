# Visual Artifact Renderer

![Visual Artifact Renderer cover](./assets/cover.jpg)

Visual Artifact Renderer turns agent output into polished visual pages: reports, code reviews, architecture briefs, dashboards, explainers, and structured summaries.

The rule is simple: **agents emit JSON, not HTML or React.** The renderer owns layout, styling, validation, and interaction.

## Demo

https://github.com/user-attachments/assets/1fdc9a6e-9566-4ae6-904d-dee1b8ee5e05

## Try it with prompts

Ask your agent for a visual artifact when markdown would be hard to scan:

- `Create a visual artifact explaining the authentication flow`
- `Compare these two solutions using a visual artifact`
- `Walk me through these code changes using a visual artifact`

## What it solves

LLM-generated HTML is brittle. It burns tokens, drifts in style, and is hard to validate.

Visual Artifact Renderer gives agents a smaller surface: pick known UI nodes, provide data, and let a trusted renderer handle the page. The model describes what to show; the renderer decides how it looks.

## How it works

```mermaid
flowchart TB
  subgraph Agent["Agent"]
    A1["Inspect source code/data"]
    A2["Read node contract"]
    A3["Build VisualArtifactSpec JSON"]
  end

  subgraph CLI["visual-artifact CLI"]
    C1["Validate spec"]
    C2["Write artifact bundle"]
    C3["Start server if needed"]
  end

  subgraph Renderer["Next.js renderer"]
    R1["Fetch JSON"]
    R2["Render trusted adapters"]
  end

  subgraph Cloudflare["Optional Cloudflare publishing"]
    P1["Upload bundle to R2"]
    P2["Serve public URL via Worker"]
  end

  A1 --> A2 --> A3 --> C1 --> C2 --> C3 --> R1 --> R2
  C1 -.->|invalid spec| A3
  C2 -.->|--publish| P1 --> P2
```

The runtime path:

1. The agent runs `visual-artifact contract` and builds a `VisualArtifactSpec`.
2. The CLI validates the spec and writes an artifact bundle.
3. The renderer fetches `artifact.json` and renders trusted adapters.

The LLM never writes routes, imports, JSX, CSS, or full HTML for the renderer.

## Features

- Constrained JSON contract for `slug`, `title`, optional `data`, and typed `nodes`.
- 30+ node types for prose, cards, tables, charts, timelines, Mermaid, SVG diagrams, tabs, accordions, logs, and diffs.
- Data-backed components that reference shared datasets by `dataKey`.
- Local-first storage under `~/.local/share/visual-artifact/artifacts` unless overridden.
- Pi extension with the `create_visual_artifact` tool.
- Static renderer with live JSON, so new artifacts appear without rebuilding.
- Node-level annotations and in-memory AI Colab review mode.
- Optional Cloudflare publishing for durable public links.
- Safe rendering boundary: CLI validation before write, Zod parse before render, adapter-only UI.

## Choose your path

Use the shell installer for the CLI and static renderer. Install agent resources through Pi's package manager or the open `skills` CLI. You do not need to clone this repo for local use.

Clone the repo if you want to develop the renderer or deploy the Cloudflare Worker. First-time Cloudflare deployment needs the repo because the Worker source, wrangler config, and cloud build live here.

If a Worker is already deployed and configured, the installed CLI can publish artifacts with `--publish`.

## Quick start

Install the latest release for local use:

```bash
curl -fsSL https://github.com/iurysza/visual-artifact-renderer/releases/latest/download/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
visual-artifact doctor
```

Repository verification uses Node.js 22.22.3, Bun 1.1.34, and pnpm 11.5.2.

Install from this repo instead if you are developing or preparing a deployment:

```bash
cd cli
bun install
bun run src/main.ts bootstrap
export PATH="$HOME/.local/bin:$PATH"
visual-artifact doctor
```

If Pi is running, use `/reload` or restart Pi after install.

Update a source-built CLI and renderer install with:

```bash
visual-artifact bootstrap
```

`bootstrap` does not install agent resources; use the Pi package or `npx skills` flow below.

More install and CLI detail: [`ai-artifacts/docs/cli.md`](./ai-artifacts/docs/cli.md).

### Install the official Pi package

Pi can manage the extension and skill together from this Git repository. Install the CLI and renderer, then install the package:

```bash
curl -fsSL https://github.com/iurysza/visual-artifact-renderer/releases/latest/download/install.sh | sh
pi install git:github.com/iurysza/visual-artifact-renderer
visual-artifact doctor
```

Run `/reload` in an existing Pi session or restart Pi. Pi records the package in `~/.pi/agent/settings.json`; manage it with:

```bash
pi list
pi config
pi update --extensions
pi remove git:github.com/iurysouza/visual-artifact-renderer
```

For a reproducible install, pin a release tag:

```bash
pi install git:github.com/iurysouza/visual-artifact-renderer@v<version>
```

Do not also install the skill with `npx skills` or copy `pi-extension/visual-artifact.ts`; the Pi package already provides both resources.

### Install the agent skill with `npx`

For other compatible agents, install only the `visual-artifact` skill from GitHub with the open `skills` CLI:

```bash
npx skills add iurysza/visual-artifact-renderer --skill visual-artifact
```

For a global Pi install without prompts:

```bash
npx skills add iurysza/visual-artifact-renderer \
  --skill visual-artifact --global --agent pi --yes
```

Update it later with:

```bash
npx skills update visual-artifact --global
```

## Create an artifact

From a file:

```bash
visual-artifact create my-spec.json
```

From stdin:

```bash
visual-artifact create - < my-spec.json
```

Minimal spec:

```json
{
  "slug": "demo-report",
  "title": "Demo Report",
  "description": "A tiny Visual Artifact Renderer artifact.",
  "nodes": [
    {
      "type": "text",
      "props": {
        "text": "The agent supplied JSON. The renderer supplied the UI.",
        "size": "lg"
      }
    }
  ]
}
```

The CLI returns a local URL like:

```text
http://127.0.0.1:9998/artifacts/my-project/demo-report/
```

`file-tree` items may use `src` as create-time input. Relative paths must stay inside the canonical project root. Outside-project reads require a repeatable explicit `--allow-read <dir>` grant; the Pi tool never grants one. The CLI strips `src` after safely inlining `content`.

## Annotations and AI Colab

Artifacts support node-level comment threads. Open an artifact and use **Comments** to select nodes, post replies, resolve threads, and copy a page link. Local writes require an existing artifact, are serialized per bundle, and use atomic mode-`0600` replacement. Writable serving is loopback-only unless `--allow-remote` is explicit; browser writes must be JSON and satisfy same-origin checks.

**Colab** mode lets a formatter or agent attach suggested comments without persisting them. You can review, edit, delete, or export those comments as Markdown.

Details: [`ai-artifacts/docs/annotations.md`](./ai-artifacts/docs/annotations.md).

## Publishing

Use `--publish` to create a durable public URL through your own Cloudflare account:

```bash
visual-artifact create my-spec.json --publish
```

Published artifacts use R2 for artifact bundles and a Worker for the static renderer, JSON endpoints, and hosted annotation writes.

First-time deployment requires a cloned repo. Setup and deployment: [`ai-artifacts/docs/publishing.md`](./ai-artifacts/docs/publishing.md).

## CLI

Common commands:

```bash
visual-artifact contract
visual-artifact validate my-spec.json
visual-artifact create my-spec.json
visual-artifact serve --no-open
visual-artifact doctor
```

Full command reference: [`ai-artifacts/docs/cli.md`](./ai-artifacts/docs/cli.md).

## Knowledge base

The docs are split like a small wiki. Start at the [`docs index`](./ai-artifacts/docs/index.md), then follow the page that matches your task.

- Use [`CLI`](./ai-artifacts/docs/cli.md) for install paths, command flags, server roles, and configuration.
- Use [`Annotations`](./ai-artifacts/docs/annotations.md) for comments, AI Colab, local writes, and hosted writes.
- Use [`Publishing`](./ai-artifacts/docs/publishing.md) for Cloudflare setup, deploys, `--publish`, and GitHub Actions.
- Use [`Architecture`](./ai-artifacts/ARCHITECTURE.md) when changing boundaries, storage, routes, or data flow.
- Use [`Node reference`](./ai-artifacts/docs/nodes.md) when composing specs or adding node types.

## Development

Run the complete pinned repository gate:

```bash
./scripts/verify.sh
```

For renderer development:

```bash
cd app
pnpm install --frozen-lockfile
pnpm dev              # http://localhost:9999/artifacts/
pnpm test
pnpm lint
pnpm export:contract
pnpm verify:artifacts
pnpm build
```

For focused CLI development:

```bash
cd cli
bun install --frozen-lockfile
bun test
bun run typecheck
bun run build
```

Run `pnpm visual:qa` if you touch adapters or styling. Use [`Reliability`](./ai-artifacts/docs/RELIABILITY.md) for the full verification map and [`Release`](./ai-artifacts/docs/RELEASE.md) before publishing a new version.

## Contract

The contract is compiled into the CLI from a shared source:

- `shared/src/contract.ts`
- `cli/assets/contract.json` (generated, tracked, and checked for drift)

Inspect it with:

```bash
visual-artifact contract
```

After contract changes:

```bash
cd app
pnpm export:contract
pnpm verify:artifacts
```

## Repository layout

```text
app/                   # Next.js renderer source + static export
cli/                   # Bun CLI source and compiled binary
shared/                # shared artifact contract + annotation schema
pi-extension/          # Pi tool wrapper for create_visual_artifact
skill/                 # agent-facing skill bundle
artifacts/             # local generated bundles, gitignored
```
