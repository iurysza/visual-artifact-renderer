# Frontend Guide

> How the Next.js renderer works and where to make changes.

## Stack

- Next.js 16 with static export (`output: 'export'`).
- React 19.
- Tailwind CSS v4 + `tw-animate-css`.
- TypeScript 5, strict.
- shadcn/ui Base UI components.
- Recharts for charts, Mermaid for diagrams, Shiki for code blocks.

## Routes

All routes live under `basePath: "/artifacts"` in `next.config.ts`:

| Route                         | File                                | Purpose                           |
| ----------------------------- | ----------------------------------- | --------------------------------- |
| `/artifacts`                  | `src/app/page.tsx`                  | home index                        |
| `/artifacts/<project>`        | `src/app/[project]/page.tsx`        | project index                     |
| `/artifacts/<project>/<slug>` | `src/app/[project]/[slug]/page.tsx` | artifact page shell               |
| `/artifacts/live-artifact`    | `src/app/live-artifact/page.tsx`    | fallback for post-build artifacts |
| `/artifacts/components`       | `src/app/components/page.tsx`       | component gallery                 |

## Rendering flow

1. `ClientArtifactLoader` parses `{ project, slug }` from the URL.
2. It fetches `/artifacts/data/artifacts/<project>/<slug>.json`.
3. `VisualArtifactRenderer` receives the parsed spec.
4. `renderNodes` recurses over `spec.nodes` and dispatches via `componentRegistry`.
5. `componentRegistry` maps `nodeType` to an adapter.

## Adding a node type

1. Add TS type + Zod schema branch in `src/lib/artifact-schema.ts`.
2. Add manifest entry in `src/lib/artifact-manifest.ts`.
3. Implement adapter in the right adapters file.
4. Register in `src/components/component-registry.tsx`.
5. Run `pnpm export:contract && pnpm test:contract && pnpm verify:artifacts && pnpm build`.

## Theming

- `next-themes` + CSS variables in `src/app/globals.css`.
- Theme class is `.dark` on `html`.
- SVG diagrams run in sandboxed iframes and must read `localStorage['visualizer-theme']` themselves.

## Path conventions

All path math is in `src/lib/paths.ts`. Do not assemble artifact URLs by hand elsewhere.

## Static export + live reload

`pnpm build` prerenders known artifacts. `pnpm serve` serves static files plus live JSON endpoints for artifacts created after the build. Unknown routes fall through to `/live-artifact`, which fetches JSON client-side.

## Design guidelines

See [`DESIGN.md`](./DESIGN.md) and the shadcn/frontend-design skills for component and visual direction.
