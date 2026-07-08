# CLI

> Install, run, validate, serve, and script `visual-artifact`.

Use this page when you need the command surface. For what the CLI hands to the renderer, see [`Architecture`](../ARCHITECTURE.md). For public upload flow, see [`Publishing`](./publishing.md). For node composition, see the [`node reference`](./nodes.md).

## Install

Install the latest release:

```bash
curl -fsSL https://github.com/iurysza/visual-artifact-renderer/releases/latest/download/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
visual-artifact doctor
```

Install from this repo:

```bash
cd cli
bun install
bun run src/main.ts bootstrap
export PATH="$HOME/.local/bin:$PATH"
visual-artifact doctor
```

`bootstrap` builds the renderer and CLI, then installs the pieces agents need.

| Piece | Installed location |
|---|---|
| CLI binary | `~/.local/bin/visual-artifact` |
| Static renderer export | `~/.local/share/visual-artifact/app/out` |
| Skill files | `~/.agents/skills/visual-artifact/` |
| Artifact storage | `~/.agents/skills/visual-artifact/artifacts/<project>/<slug>/` |
| Pi extension | `~/.pi/agent/extensions/visual-artifact.ts` |

For Pi, run `/reload` or restart Pi after install.

Custom harnesses may not read `~/.agents/skills`. If not, copy `~/.agents/skills/visual-artifact` into that harness's skill directory and wire its tool layer to call `visual-artifact create`.

## Command map

All commands use the same shape:

```text
visual-artifact [global flags] <command>
```

Use `--json` for automation, `--plain` for URL-only output, and `--no-input` in non-interactive scripts. Other global flags are `--quiet`, `--verbose`, and `--no-color`.

| Command | Purpose |
|---|---|
| `visual-artifact bootstrap [--dry-run]` | Build renderer and CLI; install CLI, global skill, and optional Pi extension copies. |
| `visual-artifact create [spec.json or -] [--project path] [--no-serve] [--publish [profile]]` | Validate, write, serve, and optionally publish an artifact. |
| `visual-artifact validate [spec.json or -]` | Validate a spec without writing it. |
| `visual-artifact contract` | Print the current artifact contract. |
| `visual-artifact serve [--port n] [--host addr] [--no-open]` | Serve the static renderer plus live artifact JSON. |
| `visual-artifact serve status` | Check server health. |
| `visual-artifact serve stop` | Best-effort stop for the local server. |
| `visual-artifact list [project]` | List projects or artifacts. |
| `visual-artifact open [project/slug]` | Open the index or one artifact. |
| `visual-artifact doctor` | Diagnose install and runtime state. |

## Create workflows

From a file:

```bash
visual-artifact create my-spec.json
```

From stdin:

```bash
cat my-spec.json | visual-artifact create
visual-artifact create - < my-spec.json
```

Machine-readable output:

```bash
visual-artifact --json create my-spec.json --no-serve
visual-artifact --plain create my-spec.json --no-serve
```

Validate before writing:

```bash
visual-artifact validate my-spec.json
```

Publish after local write:

```bash
visual-artifact create my-spec.json --publish
```

The publish path is documented in [`Publishing`](./publishing.md).

## Runtime paths

Artifact bundles use this layout:

```text
<artifacts-dir>/<project>/<slug>/
  artifact.json
  annotations.json
  publish.json   # present after successful --publish
  assets/
```

Local URLs use:

```text
http://127.0.0.1:9998/artifacts/<project>/<slug>/
```

Data endpoints use:

```text
/artifacts/data/artifacts/<project>/<slug>/artifact.json
/artifacts/data/artifacts/<project>/<slug>/annotations.json
/artifacts/data/artifacts/<project>/<slug>/assets/<file>
```

## Server roles

`pnpm dev` runs the Next.js dev server on `:9999`. Use it when editing renderer code or using live mode.

`visual-artifact serve` runs the CLI static-preview server on `:9998`. `create` starts it automatically unless you pass `--no-serve`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VISUAL_ARTIFACT_SKILL_ROOT` | auto-detected | Override skill root lookup. |
| `VISUAL_ARTIFACT_ARTIFACTS_DIR` | `<project-root>/artifacts` or `<skill-root>/artifacts` | Artifact bundle store. |
| `VISUAL_ARTIFACT_OUT_DIR` | `~/.local/share/visual-artifact/app/out` or `<project-root>/app/out` | Static renderer export. |
| `VISUAL_ARTIFACT_PORT` | `9998` | Static-preview server port. |
| `VISUAL_ARTIFACT_HOST` | `127.0.0.1` | Server bind host. |
| `VISUAL_ARTIFACT_MOUNT_PATH` | `/artifacts` | Public route prefix. |
| `VISUAL_ARTIFACT_DATA_PATH` | `/data/artifacts` | JSON data endpoint under the mount path. |
| `VISUAL_ARTIFACT_OPEN` | `1` | Open browser when serving. Set `0` to disable. |
| `VISUAL_ARTIFACT_BASE_URL` | local server URL | Base URL returned by `create` and `open`; include `/artifacts` if using a proxy. |
| `VISUAL_ARTIFACT_CONTRACT_PATH` | `<project-root>/cli/assets/contract.json` | Override contract path. |

Cloudflare publishing variables live in [`publishing.md`](./publishing.md).

## Contract

The artifact contract is compiled from `shared/src/contract.ts` and bundled into the CLI. Inspect it with:

```bash
visual-artifact contract
```

After contract changes:

```bash
cd app
pnpm export:contract
pnpm verify:artifacts
```

## Related

- [`README`](../../README.md) for the short public setup path.
- [`Architecture`](../ARCHITECTURE.md) for the create and serve data flow.
- [`Publishing`](./publishing.md) for Cloudflare setup and `--publish`.
- [`Annotations`](./annotations.md) for files written beside `artifact.json`.
- [`Reliability`](./RELIABILITY.md) for verification commands.
