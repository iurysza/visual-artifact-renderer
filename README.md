# Visualizer

Visualizer lets agents return polished visual pages instead of markdown walls: reports, code reviews, explainers, dashboards, and structured summaries.

The rule: **agents emit JSON, not React, routes, JSX, imports, CSS, or full HTML.** The `visual-artifact` CLI validates that JSON, writes it under the skill, and serves it with the bundled Next.js renderer.

- **JSON-first**: agents provide a constrained artifact spec
- **Local-first**: artifacts stay on your machine
- **Self-contained skill**: CLI, renderer, contract, and artifact store live under `skill/`
- **Static + live**: the renderer is built once but reads fresh artifact JSON at request time

![Visualizer home](./assets/home-light.png)

## Layout

```text
skill/
  SKILL.md
  artifact-contract.json
  app/                 # Next.js renderer; static export lands in app/out
  artifacts/           # generated JSON: <project>/<slug>.json
  cli/                 # Bun CLI source and compiled binary
pi-extension/
  visual-artifact.ts   # Pi tool wrapper for create_visual_artifact
```

## Install / bootstrap

Requirements: Bun, pnpm, Pi, Node.js 20+.

From this repo:

```bash
cd skill/cli
bun install
bun run src/main.ts bootstrap
export PATH="$HOME/.pi/bin:$PATH"
visual-artifact doctor
```

`bootstrap` installs renderer dependencies, builds `skill/app/out`, compiles the Bun CLI, and symlinks `visual-artifact` into `~/.pi/bin/`.

If the binary is already installed, rerun bootstrap with:

```bash
visual-artifact bootstrap
```

## Quick start

Create and serve an artifact from a file:

```bash
visual-artifact create my-spec.json
```

Create from stdin:

```bash
cat my-spec.json | visual-artifact create
# or
visual-artifact create - < my-spec.json
```

The CLI writes runtime output inside the installed skill:

```text
skill/artifacts/<project>/<slug>.json
```

In this repository, `skill/artifacts/` is intentionally gitignored except for placeholder files, so local generated projects/specs/assets are not shipped.

It returns a URL like:

```text
http://127.0.0.1:9999/artifacts/my-project/my-slug/
```

The Pi extension exposes the `create_visual_artifact` tool, which calls the same CLI path.

## Commands

```text
visual-artifact [global flags] <command>
```

Global flags: `--json`, `--plain`, `--quiet`, `--verbose`, `--no-color`, `--no-input`.

| Command | Purpose |
|---|---|
| `visual-artifact bootstrap [--dry-run]` | Build renderer, compile CLI, install symlink. |
| `visual-artifact create [spec.json|-] [--project path] [--no-serve]` | Validate, write artifact JSON, and auto-start renderer unless disabled. |
| `visual-artifact validate [spec.json|-]` | Validate without writing. |
| `visual-artifact serve [--port n] [--host addr] [--no-open]` | Serve `skill/app/out` plus live artifact JSON. |
| `visual-artifact serve status` | Check server health. |
| `visual-artifact serve stop` | Stop a tracked server when available; manually stop detached/tmux servers. |
| `visual-artifact list [project]` | List projects or artifacts. |
| `visual-artifact open [project/slug]` | Open the index or one artifact. |
| `visual-artifact doctor` | Diagnose install/runtime state. |

Machine-readable create output:

```bash
visual-artifact --json create my-spec.json --no-serve
visual-artifact --plain create my-spec.json --no-serve
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `VISUAL_ARTIFACT_ARTIFACTS_DIR` | `<skill>/artifacts` | Runtime artifact JSON store; generated contents are local output and gitignored in this repo. |
| `VISUAL_ARTIFACT_OUT_DIR` | `<skill>/app/out` | Static renderer export. |
| `VISUAL_ARTIFACT_PORT` | `9999` | Server port. |
| `VISUAL_ARTIFACT_HOST` | `0.0.0.0` | Server bind host. |
| `VISUAL_ARTIFACT_MOUNT_PATH` | `/artifacts` | Public route prefix. |
| `VISUAL_ARTIFACT_DATA_PATH` | `/data/artifacts` | JSON data endpoint prefix. |
| `VISUAL_ARTIFACT_OPEN` | `1` | Open browser when serving. Set `0` to disable. |
| `VISUAL_ARTIFACT_BASE_URL` | local server URL | Base URL returned by `create`/`open`, useful for tunnels or tailnet sharing. Include the mount path, e.g. `https://host.example/artifacts`. |
| `VISUAL_ARTIFACT_CONTRACT_PATH` | `<skill>/artifact-contract.json` | Override contract path. |

## Renderer development

```bash
cd skill/app
pnpm install
pnpm dev              # http://localhost:9999/artifacts/
pnpm build            # static export to skill/app/out
pnpm lint
pnpm export:contract
pnpm verify:artifacts
pnpm visual:qa        # optional adapter/styling QA
```

CLI development:

```bash
cd skill/cli
bun install
bun run typecheck
bun run build
bun run install:binary
```

## Contract

The contract is generated from renderer schema/manifest code:

- `skill/app/src/lib/artifact-schema.ts`
- `skill/app/src/lib/artifact-manifest.ts`
- `skill/artifact-contract.json`

After schema or manifest changes:

```bash
cd skill/app
pnpm export:contract
```

## License

[MIT](LICENSE)
