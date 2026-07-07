# Frontend Guide

> How the Next.js renderer works and where to change it.

## Stack

- Next.js 16 with static export (`output: "export"`).
- React 19.
- Tailwind CSS v4 + `tw-animate-css`.
- TypeScript 5, strict.
- shadcn/Base UI primitives.
- Recharts, Mermaid, Shiki, `react-markdown`, `remark-gfm`, `date-fns`.

All frontend source lives under `app/`.

## Routes

`app/next.config.ts` sets `basePath: "/artifacts"`.

| Public route | File | Purpose |
|---|---|---|
| `/artifacts` | `app/src/app/page.tsx` | home index |
| `/artifacts/<project>` | `app/src/app/[project]/page.tsx` | project index |
| `/artifacts/<project>/<slug>` | `app/src/app/[project]/[slug]/page.tsx` | artifact shell |
| `/artifacts/shell-artifact` | `app/src/app/shell-artifact/page.tsx` | post-build artifact fallback shell |
| `/artifacts/shell-project` | `app/src/app/shell-project/page.tsx` | post-build project fallback shell |

Artifact JSON is fetched from `/artifacts/data/artifacts/<project>/<slug>/artifact.json` and annotation JSON from `/artifacts/data/artifacts/<project>/<slug>/annotations.json`. Mutations are posted to `/artifacts/api/annotations/<project>/<slug>`.

## Rendering flow

1. CLI server serves a static shell from `app/out`.
2. `ClientArtifactLoader` parses `{ project, slug }` from `window.location`.
3. It fetches `/artifacts/data/artifacts/<project>/<slug>/artifact.json`.
4. `VisualArtifactSpecSchema` parses the payload.
5. `VisualArtifactRenderer` receives the spec and wraps the page in `AnnotationProvider` and `AIColabProvider`.
6. `renderNodes` recurses over `spec.nodes`.
7. `componentRegistry` dispatches each node to an adapter.
8. Data-backed adapters read `spec.data[dataKey]` through helpers.
9. Every rendered node is wrapped in a `NodeBoundary` with `data-va-node-*` attributes for annotation anchors.
10. `AnnotationPanel` loads annotation data and renders the comment sidebar.

## Annotation components

| Component | Responsibility | Key files |
|---|---|---|
| `AnnotationProvider` | Loads annotations, tracks comment mode, selected/hovered node, draft state, and author. | `src/components/annotations/annotation-provider.tsx` |
| `AnnotationPanel` | Fixed right sidebar that shows thread list, thread detail, or the composer. | `src/components/annotations/annotation-panel.tsx` |
| `AnnotationToggle` | Standalone Comments button used inside the panel. The site header uses its own toggle group. | `src/components/annotations/annotation-toggle.tsx` |
| `NodePickToggle` | Button to enter/exit node-selection mode for starting a new comment. | `src/components/annotations/annotation-toggle.tsx` |
| `NodePickHud` | Floating hint shown while selecting a node. | `src/components/annotations/node-pick-hud.tsx` |
| `NodeBoundary` | Wraps every rendered node in `visual-artifact-renderer.tsx` with `data-va-node-id`, `data-va-node-path`, `data-va-node-type`, and `data-va-node-label`. | `src/components/visual-artifact-renderer.tsx` |
| `annotation-helpers` | DOM anchor lookup (`findAnchorElement`), identity matching (`nodeIdentityMatches`), and thread grouping. | `src/components/annotations/annotation-helpers.ts` |
| `use-anchor-presence` | Observes whether a thread's anchor still exists in the DOM. | `src/hooks/use-anchor-presence.ts` |
| `annotations.ts` | Client fetch helpers for annotations, author, and mutations. | `src/lib/artifacts/annotations.ts` |

### Node boundaries and anchors

Each node is wrapped in a layout-neutral `div` with `display: contents` semantics preserved via CSS classes so grids, tabs, accordions, and cards keep their existing layout. When comment mode is on, the boundary adds hover/selected outlines and a thread-count badge. Clicking a node in comment mode selects it or opens an existing thread anchored to it.

Stable node IDs come from `metadata.id` in the spec. The renderer falls back to deterministic node paths (`nodes.0`, `nodes.1.children.0`, `nodes.3.props.items.0.nodes.1`) for nodes without IDs. Anchor resolution prefers `data-va-node-id` and falls back to `data-va-node-path`.

### Comment UX

- Comment mode is off by default; the artifact view stays clean.
- Toggle **Comments** from the site-header Comments/Colab segmented control to reveal node outlines and thread badges.
- Click a node to select it and open the composer in the sidebar.
- Existing threads on that node are shown above the composer.
- Click a thread in the sidebar to open its detail, scroll to the anchor, and reply.
- Resolve and reopen threads from the thread detail header.
- `Escape` closes the composer, selection, or comment mode progressively.
- Authors use git config (`user.name`, `user.email`) with a local anonymous fallback.

## AI Colab mode

AI Colab is an in-memory companion to persistent annotations. A formatter or agent can emit `spec.aiColab` with comment threads anchored to nodes or to the whole artifact. The user can review, edit, add, or remove those comments, then copy the result as sparse Markdown.

- Stored only in React state; nothing is persisted to `annotations.json` unless the user explicitly converts comments.
- Mutually exclusive with persistent comment mode: turning on Colab closes Comments and vice versa.
- Rendered in the same right sidebar as annotations, but marked as AI suggestions.

### AI Colab components

| Component | Responsibility | Key files |
|---|---|---|
| `AIColabProvider` | Holds in-memory colab comments, selection, draft state, and markdown formatting. | `src/components/ai-colab/ai-colab-provider.tsx` |
| `AIColabPanel` | Right sidebar UI for listing and editing colab comments. | `src/components/ai-colab/ai-colab-panel.tsx` |
| `AIColabHUD` | Floating hint shown while selecting a node in Colab mode. | `src/components/ai-colab/ai-colab-hud.tsx` |
| `formatArtifactForAI` | Converts the current artifact + comments into a sparse Markdown block. | `src/lib/ai-colab/formatter.ts` |

### AI Colab data flow

1. `AIColabProvider` initializes `spec.aiColab` comments in memory when the artifact loads.
2. The user toggles **Colab** from the site-header Comments/Colab control.
3. In Colab mode, clicking a node selects it and opens a composer for that node.
4. Existing colab comments are listed in the sidebar; the user can edit or delete them.
5. The **Copy Markdown** button exports the artifact plus all current colab comments as a sparse Markdown block. The block references the public artifact JSON path and lists only the comments (with line ranges into the canonical JSON), so the LLM can read the full artifact separately. The formatter lives in `src/lib/ai-colab/formatter.ts`.

## Annotation data flow

1. `AnnotationProvider` fetches `annotations.json` and the local author on mount.
2. User actions create an `AnnotationMutation` (`createThread`, `addMessage`, `resolveThread`, `reopenThread`).
3. The provider applies the mutation optimistically to local state, then POSTs the mutation array to the CLI server.
4. On error, the provider rolls back to the previous document and shows the error in the sidebar.
5. On success, the updated document is returned and parsed with the shared annotation schema.

## Mobile and touch

Comment and Colab modes both support touch devices, but node selection is more involved than on desktop.

- Node pick is a two-step flow on touch: tap a node to preview the selection, then tap again to confirm.
- Touch handlers suppress stray click events after a drag/scroll so selecting a node does not accidentally activate an interactive child (buttons, links, tabs).
- The composer and panel headers have mobile-specific compact layouts.
- Keyboard shortcuts are hidden on mobile; rely on the panel header buttons.

## Adding a node type

1. Add TS type + Zod schema branch in `app/src/lib/contract/artifact-schema.ts`.
2. Add manifest entry in `app/src/lib/contract/artifact-manifest.ts`.
3. Implement adapter in `app/src/components/adapters/`.
4. Register it in `app/src/components/component-registry.tsx`.
5. Run:

```bash
cd app
pnpm export:contract
pnpm verify:artifacts
pnpm lint
pnpm build
```

If the compiled CLI needs the new fallback contract, also run:

```bash
cd cli
bun run build
```

## Theming

- `next-themes` toggles `.dark` on `html`.
- CSS variables live in `app/src/app/globals.css`.
- Tailwind v4 maps tokens through `@theme inline`.
- `svg-diagram` iframes do not inherit parent classes; they need their own theme script.

## Path conventions

All app path math belongs in `app/src/lib/paths.ts`.

Do not hand-assemble artifact URLs in components. Import helpers like:

- `artifactPagePath`
- `projectPagePath`
- `artifactDataUrl`
- `artifactAnnotationsUrl`
- `artifactAnnotationsApiUrl`
- `artifactParamsFromPath`
- `projectParamsFromPath`

CLI path/base URL logic lives in `cli/src/config.ts` and command files.

## Static export + live reload

```bash
cd app
pnpm build

cd ../cli
bun run src/main.ts serve --no-open
```

The server:

- serves static files from `<skill-root>/app/out`
- serves artifact JSON/assets from `<skill-root>/artifacts`
- creates live index JSON endpoints
- serves `shell-artifact` or `shell-project` shells for artifacts/projects created after build

## Design references

- [`DESIGN.md`](./DESIGN.md)
- [`design-docs/theme-system.md`](./design-docs/theme-system.md)
- [`design-docs/diagram-sandboxing.md`](./design-docs/diagram-sandboxing.md)
