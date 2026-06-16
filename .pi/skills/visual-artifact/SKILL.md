---
name: visual-artifact
description: Generate visual artifacts (codebase overviews, architecture diagrams, dashboards, explainers) from code or data. Routes the model through the vaz-pipeline for codebase artifacts or direct create_visual_artifact for simple data-driven artifacts.
---

# visual-artifact

Generate visual artifacts (codebase overviews, architecture diagrams, dashboards, explainers) from code or data.

## Activation triggers

Use this skill when the user asks for:

- "generate a visual artifact"
- "codebase overview" / "architecture overview"
- "diagram this project"
- "visual summary of the repo"
- Any request that ends with a rendered artifact page

## Router: choose the right path

The model must route the request before acting.

### Route A — Full codebase visual artifact (pipeline)

Use when the user wants to understand a codebase and needs a rendered artifact.

Steps:

1. `vaz-doctor` — verify installation. If it fails, run `./install.sh` from the visualizer repo (or `~/.pi/skills/visual-artifact/bootstrap.sh`), then retry.
2. `vaz-status` — check renderer. If not running, run `vaz-serve` and wait until `vaz-status` returns `{"running": true}`.
3. `vaz-pipeline <repoRoot> [slug]` — run the multi-pass pipeline.
4. Parse the final JSON output to get `visualArtifactSpecPath`.
5. Read that JSON file.
6. Call `create_visual_artifact` with the JSON payload, including the `data` object.
7. Return the artifact URL from the tool result.

If `create_visual_artifact` fails with a validation error, read the error, fix the JSON file, and retry. Repeat until the tool succeeds.

### Route B — Direct artifact from provided data

Use when the user already gave you nodes, data tables, or a clear spec.

Steps:

1. Build a `VisualArtifactSpec` directly (valid against the schema in the visualizer runtime).
2. Optionally start the renderer with `vaz-serve` if you want a local URL.
3. Call `create_visual_artifact` with the spec.
4. Return the artifact URL.

### Route C — Report-only (future)

Generate deterministic packets and agentic reports without building a final artifact. Use the individual pipeline steps:

- `pnpm extract` / deterministic extraction only
- `pnpm extract:agentic` / agentic reports only
- `pnpm extract:director` / report director only
- `pnpm extract:visualization` / visualization strategy only
- `pnpm extract:assembler` / final assembler only

These require `cd` into `~/.pi/tools/visualizer` and are intended for debugging, not end-user delivery.

### Route D — Data dashboard from CSV/JSON (future)

Not yet implemented. Build a `VisualArtifactSpec` with chart/table nodes directly from the provided data file.

## Wrapper commands (what the model should call)

These commands are installed to `~/.pi/bin/` and hide the visualizer runtime path.

| Command | Purpose |
|---------|---------|
| `vaz-doctor` | Verify runtime, deps, tools, wrappers, and renderer health. |
| `vaz-serve` | Start the renderer on `http://localhost:9999` if not running. |
| `vaz-status` | Check if the renderer is running. Returns JSON. |
| `vaz-pipeline <repoRoot> [slug]` | Run the full extraction + assembly pipeline for a repo. |

If the wrappers are not on `PATH`, either add them first (`export PATH="$HOME/.pi/bin:$PATH"`) or call them with the full path (`$HOME/.pi/bin/vaz-doctor`). `vaz-doctor` recognizes wrappers in `~/.pi/bin` even when they are not on `PATH`.

## Installation

### First-time install (from the visualizer repo)

```bash
./install.sh
```

This copies the skill to `~/.pi/skills/visual-artifact`, links the runtime to `~/.pi/tools/visualizer`, installs wrapper scripts to `~/.pi/bin`, and runs `pnpm install`.

### Repair / bootstrap (if runtime or wrappers are missing)

```bash
~/.pi/skills/visual-artifact/bootstrap.sh
```

### PATH

Ensure `~/.pi/bin` is in your PATH. `install.sh` will remind you if it is not.

## Pipeline output

`vaz-pipeline` writes to `<repoRoot>/ai-artifacts/generated/<slug>/`:

- `extractor-digest.md`
- `extractor-run.json`
- `packets/*.json`
- `reports/*.md`
- `report-direction.json`
- `report-direction.md`
- `visualization-strategy.md`
- `visual-artifact-spec.json` ← final input to `create_visual_artifact`

## Critical rules

- **Never call `create_visual_artifact` from inside a `pi --print` subprocess.** The assembler pass writes JSON to disk; the parent agent (you) calls the tool.
- **Always pass the `data` object** from `visual-artifact-spec.json` to `create_visual_artifact`.
- **Before calling `create_visual_artifact`, read `~/.pi/tools/visualizer/artifact-contract.json`** and only use supported node types and props.
- **Keep the renderer running** before calling `create_visual_artifact` if you want the artifact URL to resolve locally.
- **Orientation-first, not fix-first:** for codebase artifacts, answer "what is this project?" before recommendations.
- **Deterministic extractors output facts only.** Interpretation belongs to agentic report workflows, the report director, and the visualization strategy.

## Extending this skill

New routes and tools can be added in two places:

1. **Skill router** (this file): add a new Route X with conditions and steps.
2. **Runtime scripts** (`~/.pi/tools/visualizer/scripts/extract/`): add new pipeline steps or standalone tools, then expose them via new `vaz-*` wrapper scripts.

When the skill is redistributed, `install.sh` packages the skill + runtime together so wrappers and runtime stay in sync.
