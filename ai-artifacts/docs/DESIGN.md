# Design System

> Visual direction for the renderer. The LLM picks nodes; the renderer owns CSS, layout, and component behavior.

## Identity

Visualizer artifacts should feel like polished technical reports: clear hierarchy, warm neutrals, intentional accents, readable data. Not a dashboard template. Not a slide deck. Not raw HTML cosplay.

## Token source

Tokens live in `app/src/app/globals.css`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#faf9f5` | `#151412` | page background |
| `--foreground` | `#141413` | `#f5f0e8` | primary text |
| `--card` | `#ffffff` | `#1f1e1b` | cards/panels |
| `--primary` | foreground | foreground | primary actions/emphasis |
| `--accent` | `#e3dacc` | `#3a332b` | soft emphasis |
| `--clay` | `#d97757` | `#e08a69` | primary accent, charts, focus |
| `--olive` | `#788c5d` | `#9faf7c` | success/secondary charts |
| `--rust` | `#b04a3f` | `#ef8f86` | destructive/risk |
| `--border` | `#d1cfc5` | `#454038` | dividers/borders |

Border radius base is `0.75rem`, scaled across semantic radius tokens.

## Typography

- Sans: Geist Sans (`--font-geist-sans`)
- Mono: Geist Mono (`--font-geist-mono`)
- Editorial/heading: `--font-editorial`

Headings use the editorial stack for report-like weight. Code and data use mono. Body uses sans.

## Component foundation

- Next.js + React renderer in `app/`.
- shadcn/Base UI primitives in `app/src/components/ui`.
- Lucide icons via `lucide-react`.
- Artifact primitives in `app/src/components/artifact-primitives.tsx`.
- Charts via Recharts.
- Markdown via `react-markdown` + `remark-gfm`.
- Code highlighting via Shiki.

## Node philosophy

- Open with a thesis, then a summary band.
- Use `stat-card` for hero facts, not generic cards.
- Use `status-grid` for health/readiness/risk boards.
- Use `comparison-table` and `data-table` for structured evidence.
- Use `flow` or `mermaid` for architecture/data/request paths.
- Use `accordion` only for secondary detail.
- Avoid nested card soup.

## Diagram design

- Mermaid is the default for topology, sequence, state, ERD, class, and C4-style diagrams.
- `svg-diagram` is the escape hatch for precise layout or interactivity; it renders inside a sandboxed iframe.
- SVG diagrams must carry their own theme variables and before-paint theme script.

## Change semantics

Plan nodes mark what a change adds, changes or removes. These marks are tokens in `app/src/app/globals.css`, not one-off Tailwind colours.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--change-added` | `#5f7444` (olive, darkened for AA text on paper) | `#9faf7c` | `+` added |
| `--change-changed` | `var(--amber)` `#a86b12` | `var(--amber)` `#e0b45c` | `~` changed |
| `--change-removed` | `var(--rust)` | `var(--rust)` | `-` removed, with strike-through |
| proposed (pattern) | `--change-added` + `stroke-dasharray: 5 4` / `border-style: dashed` | same | proposed but not yet real |
| dashed edge (pattern) | `--muted-foreground` stroke + `stroke-dasharray: 2 4` | same | a node's own `dashed` meaning |
| `--canvas-dot` | `color-mix(in oklch, var(--slate), transparent 88%)` | `color-mix(in oklch, var(--slate), transparent 90%)` | diagram dot grid |
| `--amber` | `#a86b12` | `#e0b45c` | palette colour, `--color-amber` in `@theme` |

`--color-amber` and `--color-change-*` are mapped in `@theme inline`.

Colour is never the only signal. Every mark also has a glyph (`+ ~ - ?`) or a dash pattern, and an accessible name such as "added", "changed" or "removed".

### Diagram canvas

Plan diagrams (`state-machine`, `box-diagram`) draw on a dot grid: the `.va-dot-grid` utility, a `--canvas-dot` radial-gradient on `--card` with a 16 px pitch. Diagrams that can overflow scroll horizontally in their own container and show a fade on the right edge.

### Two kinds of dashed line

- **Green long dash means proposed.** A `+` prefix or `mark: "proposed" | "added"` draws in `--change-added` with the `5 4` dash.
- **Muted short dash is the node's own `dashed` meaning.** A `style: "dashed"` edge draws in muted ink with the `2 4` dash. In `box-diagram` the `dashed` prop names it in the legend. The `sequence-diagram` reply style uses the same pattern.

Both can apply at once: a proposed dashed edge is green with the `2 4` pattern. `state-machine` and `call-stack` have no `style` prop, so there dashed always means proposed.

### Callout tones are separate from `ToneSchema`

`alert.tone` and `code-block.annotations[].tone` use a callout vocabulary: `info · warn · risk · ok · idea`. This is deliberately separate from `ToneSchema` (`default · accent · success · warning · danger`). Callout tones describe the author's intent for a note. `ToneSchema` describes status. Do not merge them.

## Sources of truth

- Tokens/theme: `app/src/app/globals.css`
- shadcn config: `app/components.json`
- Node catalog: `app/src/lib/contract/artifact-manifest.ts`
- Renderer primitives: `app/src/components/artifact-primitives.tsx`
- Diagram rules: [`design-docs/diagram-sandboxing.md`](./design-docs/diagram-sandboxing.md)
