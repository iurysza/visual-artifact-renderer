# Visualizer

Visualizer lets agents return polished visual pages instead of plain markdown: reports, code reviews, explainers, dashboards, or any structured output. The agent calls one tool with JSON data; Visualizer validates it, renders known components, stores it under `~/.pi/artifacts`, and gives each page its own `/artifacts/...` route.

The rule: **agents emit JSON, not React, routes, JSX, imports, CSS, or full HTML.** That saves tokens, keeps pages consistent, and leaves rendering to trusted code. Skills can steer which components agents use, which layouts work best, and which patterns to avoid.

[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

- **Visual output**: structured pages instead of long markdown dumps
- **JSON-first**: agents provide data; the renderer owns the UI
- **Local-first**: artifacts stay on your machine
- **Extensible**: add new components without changing how agents call the tool
- **Static + live**: build once, load new artifacts later

![Visualizer home](./assets/home-light.png)

## Install

```bash
./install.sh
```

This installs dependencies, the Pi extension, the visual-artifact skill, and `vaz-*` helper commands.

Requirements: Node.js 20+, pnpm, Pi, and macOS/Linux/Windows.

## Quick start

### 1. Start the live server

```bash
export PATH="$HOME/.pi/bin:$PATH"
vaz-serve
```

Open `http://localhost:9999/artifacts/`.

This is the viewer. It keeps serving fresh artifact JSON from `~/.pi/artifacts`, so new artifacts show up without rebuilding.

### 2. Create an artifact

Ask Pi to create a visual artifact:

```text
Create a visual artifact called "Q2 Revenue" with a few stat cards.
```

Pi calls `create_visual_artifact`, which validates the spec, writes:

```txt
~/.pi/artifacts/<project>/<slug>.json
```

and returns a URL like:

```txt
http://localhost:9999/artifacts/my-project/q2-revenue/
```

## What developers need to know

Visualizer has four moving parts:

- **Renderer**: the Next.js app that displays artifacts.
- **Artifact store**: JSON files in `~/.pi/artifacts/<project>/`.
- **Pi extension**: exposes `create_visual_artifact`, validates specs, and writes artifacts.
- **Contract**: `artifact-contract.json`, generated from the schema and manifest.

For normal use, run `vaz-serve`. For renderer development, use `pnpm dev`. The wrappers exist so Pi and scripts can start the renderer, inspect health, and build share URLs without knowing repo internals.

## Running locally

### Live artifact server

```bash
vaz-serve
```

Starts the renderer if needed and serves live artifact updates from `~/.pi/artifacts`.

### Frontend dev server

```bash
pnpm dev
```

Use this when changing the renderer itself. It runs on `http://localhost:9999/artifacts/`.

### Static export + live server

```bash
pnpm build
pnpm serve
```

The static server serves `out/` under `/artifacts/` and still reads fresh artifact JSON from `~/.pi/artifacts`, so new artifacts appear without rebuilding.

### Tailscale sharing

```bash
vaz-tailscale setup
vaz-tailscale url <project> <slug>
```

Set this if you want generated artifacts to return tailnet URLs:

```bash
export VISUAL_ARTIFACT_BASE_URL="$(vaz-tailscale url)"
```

## Helper commands

Installed by `./install.sh` into `~/.pi/bin`.

You do not need these for normal frontend work. They are for Pi sessions, scripts, sharing, and troubleshooting.

- `vaz-serve` — start the renderer if it is not running
- `vaz-status` — check whether the renderer is alive; returns JSON
- `vaz-doctor` — diagnose install, runtime, wrapper, and renderer issues
- `vaz-tailscale setup` — expose `/artifacts/` on your tailnet
- `vaz-tailscale url [project] [slug]` — print the share URL

## Configuration

```bash
VISUALIZER_PORT=9999
VISUALIZER_HOST=127.0.0.1
VISUALIZER_OUT_DIR=./out
VISUALIZER_ARTIFACTS_DIR=~/.pi/artifacts
VISUALIZER_MOUNT_PATH=/artifacts
VISUALIZER_OPEN=1
VISUAL_ARTIFACT_BASE_URL=http://localhost:9999/artifacts
VISUALIZER_CONTRACT_PATH=/path/to/visualizer
```

## Verify

```bash
pnpm lint
pnpm export:contract
pnpm test:contract
pnpm verify:artifacts
pnpm build
```

Optional checks:

```bash
pnpm visual:qa
pnpm health-check
```

## License

[MIT](LICENSE)
