# Frontend Guide

> How the Next.js renderer works and where to change it.

## Stack

- Next.js 16 with static export (`output: "export"`).
- React 19.
- Tailwind CSS v4 + `tw-animate-css`.
- TypeScript 5, strict.
- shadcn/Base UI primitives.
- Recharts, Mermaid, Shiki, `react-markdown`, `remark-gfm`, `date-fns`.

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

Artifact JSON is fetched from `/artifacts/data/artifacts/<project>/<slug>/artifact.json` and annotation JSON from `/artifacts/data/artifacts/<project>/<slug>/annotations.json`. Mutations are posted to `/artifacts/api/annotations/<project>/<slug>`.

## Rendering flow

1. CLI server serves a static shell from `skill/app/out`.
2. `ClientArtifactLoader` parses `{ project, slug }` from `window.location`.
3. It fetches `/artifacts/data/artifacts/<project>/<slug>/artifact.json`.
4. `VisualArtifactSpecSchema` parses the payload.
5. `VisualArtifactRenderer` receives the spec and wraps the page in `AnnotationProvider`.
6. `renderNodes` recurses over `spec.nodes`.
7. `componentRegistry` dispatches each node to an adapter.
8. Data-backed adapters read `spec.data[dataKey]` through helpers.
9. Every rendered node is wrapped in a `NodeBoundary` with `data-va-node-*` attributes for annotation anchors.
10. `AnnotationPanel` loads annotation data and renders the comment sidebar.

## Annotation components

| Component | Responsibility | Key files |
|---|---|---|
| `AnnotationProvider` | Loads annotations, tracks comment mode, selected/hovered node, draft state, and author. | `src/components/annotation-provider.tsx` |
| `AnnotationToggle` | Header button that toggles comment mode. | `src/components/annotation-toggle.tsx` |
| `AnnotationPanel` | Fixed right sidebar that shows thread list, thread detail, or the composer. | `src/components/annotation-panel.tsx` |
| `NodeBoundary` | Wraps every rendered node in `visual-artifact-renderer.tsx` with `data-va-node-id`, `data-va-node-path`, `data-va-node-type`, and `data-va-node-label`. | `src/components/visual-artifact-renderer.tsx` |
| `annotation-helpers` | DOM anchor lookup (`findAnchorElement`), identity matching (`nodeIdentityMatches`), and thread grouping. | `src/components/annotation-helpers.ts` |
| `use-anchor-presence` | Observes whether a thread's anchor still exists in the DOM. | `src/hooks/use-anchor-presence.ts` |
| `annotations.ts` | Client fetch helpers for annotations, author, and mutations. | `src/lib/artifacts/annotations.ts` |

### Node boundaries and anchors

Each node is wrapped in a layout-neutral `div` with `display: contents` semantics preserved via CSS classes so grids, tabs, accordions, and cards keep their existing layout. When comment mode is on, the boundary adds hover/selected outlines and a thread-count badge. Clicking a node in comment mode selects it or opens an existing thread anchored to it.

Stable node IDs come from `metadata.id` in the spec. The renderer falls back to deterministic node paths (`nodes.0`, `nodes.1.children.0`, `nodes.3.props.items.0.nodes.1`) for nodes without IDs. Anchor resolution prefers `data-va-node-id` and falls back to `data-va-node-path`.

### Comment UX

- Comment mode is off by default; the artifact view stays clean.
- Toggle comment mode to reveal node outlines and thread badges.
- Click a node to select it and open the composer in the sidebar.
- Existing threads on that node are shown above the composer.
- Click a thread in the sidebar to open its detail, scroll to the anchor, and reply.
- Resolve and reopen threads from the thread detail.
- `Escape` closes the composer, selection, or comment mode progressively.
- Authors use git config (`user.name`, `user.email`) with a local anonymous fallback.

### Annotation data flow

1. `AnnotationProvider` fetches `annotations.json` and the local author on mount.
2. User actions create an `AnnotationMutation` (`createThread`, `addMessage`, `resolveThread`, `reopenThread`).
3. The provider applies the mutation optimistically to local state, then POSTs the mutation array to the CLI server.
4. On error, the provider rolls back to the previous document and shows the error in the sidebar.
5. On success, the updated document is returned and parsed with the shared annotation schema.

## Adding a node type

1. Add TS type + Zod schema branch in `skill/app/src/lib/contract/artifact-schema.ts`.
2. Add manifest entry in `skill/app/src/lib/contract/artifact-manifest.ts`.
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
- `artifactAnnotationsUrl`
- `artifactAnnotationsApiUrl`
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
