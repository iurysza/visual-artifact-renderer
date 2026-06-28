# Frontend Guide

> How the Next.js renderer works and where to change it.

## Stack

- Next.js 16 with static export (`output: "export"`).
- React 19.
- Tailwind CSS v4 + `tw-animate-css`.
- TypeScript 5, strict.
- shadcn/Base UI primitives.
- Recharts, Mermaid, Shiki, `react-markdown`, `remark-gfm`.

All frontend source lives under `skill/app`.

## Routes

`skill/app/next.config.ts` sets `basePath: "/artifacts"`.

| Public route | File | Purpose |
|---|---|---|
| `/artifacts` | `skill/app/src/app/page.tsx` | home index |
| `/artifacts/<project>` | `skill/app/src/app/[project]/page.tsx` | project index |
| `/artifacts/<project>/<slug>` | `skill/app/src/app/[project]/[slug]/page.tsx` | artifact shell |
| `/artifacts/live-artifact` | `skill/app/src/app/live-artifact/page.tsx` | post-build artifact fallback |
| `/artifacts/live-project` | `skill/app/src/app/live-project/page.tsx` | post-build project fallback |
| `/artifacts/components` | `skill/app/src/app/components/page.tsx` | component gallery |
| `/artifacts/teaching` | `skill/app/src/app/teaching/page.tsx` | teaching/demo surface |

## Rendering flow

1. CLI server serves a static shell from `skill/app/out`.
2. `ClientArtifactLoader` parses `{ project, slug }` from `window.location`.
3. It fetches `/artifacts/data/artifacts/<project>/<slug>.json`.
4. `VisualArtifactSpecSchema` parses the payload.
5. `VisualArtifactRenderer` receives the spec.
6. `renderNodes` recurses over `spec.nodes`.
7. `componentRegistry` dispatches each node to an adapter.
8. Data-backed adapters read `spec.data[dataKey]` through helpers.

## Adding a node type

1. Add TS type + Zod schema branch in `skill/app/src/lib/artifact-schema.ts`.
2. Add manifest entry in `skill/app/src/lib/artifact-manifest.ts`.
3. Implement adapter in `skill/app/src/components/adapters/`.
4. Register it in `skill/app/src/components/component-registry.tsx`.
5. Run:

```bash
cd skill/app
pnpm export:contract
pnpm verify:artifacts
pnpm lint
pnpm build
```

If the compiled CLI needs the new fallback contract, also run:

```bash
cd skill/cli
bun run build
```

## Theming

- `next-themes` toggles `.dark` on `html`.
- CSS variables live in `skill/app/src/app/globals.css`.
- Tailwind v4 maps tokens through `@theme inline`.
- `svg-diagram` iframes do not inherit parent classes; they need their own theme script.

## Path conventions

All app path math belongs in `skill/app/src/lib/paths.ts`.

Do not hand-assemble artifact URLs in components. Import helpers like:

- `artifactPagePath`
- `projectPagePath`
- `artifactDataUrl`
- `artifactParamsFromPath`
- `projectParamsFromPath`

CLI path/base URL logic lives in `skill/cli/src/config.ts` and command files.

## Static export + live reload

```bash
cd skill/app
pnpm build

cd ../cli
bun run src/main.ts serve --no-open
```

The server:

- serves static files from `<skill-root>/app/out`
- serves artifact JSON/assets from `<skill-root>/artifacts`
- creates live index JSON endpoints
- serves `live-artifact` or `live-project` shell for artifacts/projects created after build

## Design references

- [`DESIGN.md`](./DESIGN.md)
- [`design-docs/theme-system.md`](./design-docs/theme-system.md)
- [`design-docs/diagram-sandboxing.md`](./design-docs/diagram-sandboxing.md)
