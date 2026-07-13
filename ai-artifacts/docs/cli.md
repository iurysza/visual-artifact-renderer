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

For Pi, use its package manager for the extension and skill while the release installer provides the CLI and renderer:

```bash
curl -fsSL https://github.com/iurysza/visual-artifact-renderer/releases/latest/download/install.sh | sh
pi install git:github.com/iurysouza/visual-artifact-renderer
visual-artifact doctor
```

Run `/reload` or restart Pi. Use `pi update --extensions` to update an unpinned package, `pi config` to toggle its resources, and `pi remove git:github.com/iurysouza/visual-artifact-renderer` to remove it. Pin `@v<version>` when reproducibility matters. The package includes the extension and skill.

Install from this repo:

```bash
cd cli
bun install
bun run src/main.ts bootstrap
export PATH="$HOME/.local/bin:$PATH"
visual-artifact doctor
```

`bootstrap` builds and installs the CLI and renderer.

| Piece | Installed location |
|---|---|
| CLI binary | `~/.local/bin/visual-artifact` |
| Static renderer export | `~/.local/share/visual-artifact/app/out` |
| Artifact storage | `~/.local/share/visual-artifact/artifacts/<project>/<slug>/` |

The Pi package provides the extension and skill.

For Pi, run `/reload` or restart Pi after install.

Other compatible agents can install the skill with `npx skills add iurysouza/visual-artifact-renderer --skill visual-artifact`.

## Command map

All commands use the same shape:

```text
visual-artifact [global flags] <command>
```

Use `--json` for one versioned JSON document, `--plain` for stable tab-delimited/line-oriented records, and `--no-input` in non-interactive scripts. `create`, `open`, and `serve` emit their URL as the plain record; other commands emit command-specific records such as `VALID`, `PROJECT`, `ARTIFACT`, `PASS`, or `RUNNING`. `--quiet` suppresses diagnostics, never primary stdout. Other global flags are `--verbose`, `--no-color`, and `--allow-remote`.

| Command | Purpose |
|---|---|
| `visual-artifact bootstrap [--dry-run]` | Build and install the renderer and CLI. |
| `visual-artifact create [spec.json or -] [--project path] [--dry-run] [--no-serve] [--publish [profile]] [--allow-read dir]` | Validate, write, serve, and optionally publish an artifact. `--allow-read` is repeatable. |
| `visual-artifact validate [spec.json or -]` | Validate a spec without writing it. |
| `visual-artifact contract` | Print the current artifact contract. |
| `visual-artifact serve [--port n] [--host addr] [--no-open]` | Serve the static renderer, live artifact JSON, and writable annotation API. Non-loopback binds require global `--allow-remote` or `VISUAL_ARTIFACT_ALLOW_REMOTE=1`. |
| `visual-artifact serve status [--host addr] [--port n]` | Check server health and whether it is tracked by local lifecycle state. |
| `visual-artifact serve stop [--host addr] [--port n] [--force]` | Stop a tracked local server via tokenized shutdown, with conservative fallback process termination. |
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
visual-artifact create my-spec.json --dry-run
```

Create-time `file-tree` sources are project-contained by default:

```bash
visual-artifact create my-spec.json --allow-read ../approved-source
```

Relative `src` paths must resolve inside the canonical project root. Absolute paths and outside-project reads require a matching canonical `--allow-read` root. Raw `..` segments and symlink escapes are rejected. `content` wins over `src`, and successful creation strips `src` after inlining.

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
http://127.0.0.1:9998/<project>/<slug>/
```

Data endpoints use:

```text
/data/artifacts/<project>/<slug>/artifact.json
/data/artifacts/<project>/<slug>/annotations.json
/data/artifacts/<project>/<slug>/assets/<file>
```

Local server lifecycle state uses per-address files:

```text
${XDG_STATE_HOME:-~/.local/state}/visual-artifact/servers/<host>-<port>.json
```

The state file records PID, host, port, process identity metadata, and a random shutdown token. It is written after `serve` binds successfully and removed during normal shutdown.

## Server roles

`pnpm dev` runs the Next.js dev server on `:9999`. Use it when editing renderer code or using live mode.

`visual-artifact serve` runs the CLI static-preview server on `:9998`. `create` starts it automatically unless you pass `--no-serve`.

The local server exposes a token-protected shutdown endpoint at `/api/shutdown`. Use `visual-artifact serve stop` to call it from the matching state file. If state is missing, stop only terminates a listener that clearly looks like `visual-artifact serve`; ambiguous listeners are refused unless `--force` is explicit. Use `serve status --json` to see `running`, `tracked`, `statePath`, and `pid` fields for automation.

The annotation mutation API is writable. It requires POST with `application/json`, rejects cross-origin browser evidence, and permits the loopback Next dev proxy. Requests without browser origin metadata remain available to CLI/tests. Annotation reads and writes require an existing `artifact.json`; local mutations are serialized per bundle and atomically replace a mode-`0600` `annotations.json`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VISUAL_ARTIFACT_ARTIFACTS_DIR` | `<project-root>/artifacts` in source development; otherwise `~/.local/share/visual-artifact/artifacts` | Artifact bundle store. |
| `VISUAL_ARTIFACT_OUT_DIR` | `~/.local/share/visual-artifact/app/out` or `<project-root>/app/out` | Static renderer export. |
| `VISUAL_ARTIFACT_PORT` | `9998` | Static-preview server port. |
| `VISUAL_ARTIFACT_HOST` | `127.0.0.1` | Server bind host. |
| `VISUAL_ARTIFACT_DATA_PATH` | `/data/artifacts` | JSON data endpoint path. |
| `VISUAL_ARTIFACT_OPEN` | `1` | Open browser when serving. Set `0` to disable. |
| `VISUAL_ARTIFACT_ALLOW_REMOTE` | `0` | Permit a non-loopback bind for the writable server. Only strict `0` or `1` is accepted. |
| `VISUAL_ARTIFACT_BASE_URL` | local server URL | Base URL returned by `create` and `open`. |
| `VISUAL_ARTIFACT_CONTRACT_PATH` | `<project-root>/cli/assets/contract.json` | Override contract path. |

Cloudflare publishing variables live in [`publishing.md`](./publishing.md).

## Contract and enforced limits

The executable schema lives in `shared/src/artifact-schema.ts`; `shared/src/contract.ts` supplies the LLM-facing manifest. `cli/assets/contract.json` is generated, tracked, checked for drift, and bundled into the CLI. Inspect it with:

```bash
visual-artifact contract
```

After contract changes:

```bash
cd app
pnpm export:contract
pnpm verify:artifacts
```

The validator enforces: 2 MiB raw/final JSON; 30 top-level and 100 total nodes; 20 datasets; node depth 8; 500 aggregate file-tree items; file-tree depth 12; 512 KiB per sourced file; and 1 MiB aggregate sourced content.

## Related

- [`README`](../../README.md) for the short public setup path.
- [`Architecture`](../ARCHITECTURE.md) for the create and serve data flow.
- [`Publishing`](./publishing.md) for Cloudflare setup and `--publish`.
- [`Annotations`](./annotations.md) for files written beside `artifact.json`.
- [`Reliability`](./RELIABILITY.md) for verification commands.
