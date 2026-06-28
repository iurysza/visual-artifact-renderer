# User Journey

> How an agent produces a visual artifact.

## Direct creation

1. Agent runs `visual-artifact contract` to see the available node types.
2. Agent builds a `VisualArtifactSpec`: `slug`, `title`, optional `description`, optional `data`, and `nodes`.
3. Agent calls `create_visual_artifact` or runs `visual-artifact create`.
4. CLI validates the spec against the exported contract.
5. CLI writes `<skill-root>/artifacts/<project>/<slug>.json`.
6. CLI starts the renderer if needed.
7. User opens `/artifacts/<project>/<slug>/`.
8. Renderer fetches JSON and displays the page.

## CLI-first creation

```bash
visual-artifact validate spec.json
visual-artifact create spec.json --project /path/to/repo
visual-artifact open <project>/<slug>
```

The project name is derived from the git root name when possible.

## Pi tool creation

```text
create_visual_artifact({ slug, title, description, data, nodes })
  → extension delegates to visual-artifact create - --project <cwd> --json
  → returns URL
```

## Local viewing

- Dev renderer: `cd skill/app && pnpm dev`.
- Built renderer: `visual-artifact serve --no-open`.
- Default local URL: `http://127.0.0.1:9999/artifacts`.
- New artifacts appear without rebuilding because the CLI server serves live JSON.

## Sharing

Set `VISUAL_ARTIFACT_BASE_URL` to the externally reachable `/artifacts` base URL when serving through a tunnel, reverse proxy, or tailnet route.
