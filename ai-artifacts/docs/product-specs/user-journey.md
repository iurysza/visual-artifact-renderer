# User Journey

> How an agent produces a visual artifact.

## Direct creation

1. Agent reads `artifact-contract.json`.
2. Agent builds a `VisualArtifactSpec` (title, slug, nodes, optional data).
3. Agent calls `create_visual_artifact`.
4. Pi extension validates the spec and writes `~/.pi/artifacts/<project>/<slug>.json`.
5. Extension returns local and tailnet URLs.
6. User opens the URL; the renderer fetches and displays the spec.

## Codebase artifact

1. User runs `vaz-pipeline /path/to/repo [slug]`.
2. Pipeline extracts repo structure, runs agentic reports, decides a thesis, and assembles a visualization strategy.
3. Final assembler writes `visual-artifact-spec.json`.
4. Parent agent reads the spec and calls `create_visual_artifact`.
5. Renderer serves the page.

## Local sharing

- `pnpm dev` or `pnpm serve` runs on `http://localhost:9999/artifacts`.
- Tailscale Serve proxies the same `/artifacts` path on the tailnet.
- New artifacts appear without rebuilding thanks to live JSON endpoints.
