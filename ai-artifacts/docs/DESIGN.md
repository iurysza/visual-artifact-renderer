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
- Use `annotated-visual` for visible anatomy, `visual-sequence` for learner-paced change, and `knowledge-check` for retrieval feedback.
- Use `accordion` only for secondary detail.
- Avoid nested card soup.

## Diagram design

- Mermaid is the default for topology, sequence, state, ERD, class, and C4-style diagrams.
- `svg-diagram` is the escape hatch for precise layout or interactivity; it renders inside a sandboxed iframe.
- SVG diagrams must carry their own theme variables and before-paint theme script.

## Sources of truth

- Tokens/theme: `app/src/app/globals.css`
- shadcn config: `app/components.json`
- Node catalog: `app/src/lib/contract/artifact-manifest.ts`
- Renderer primitives: `app/src/components/artifact-primitives.tsx`
- Diagram rules: [`design-docs/diagram-sandboxing.md`](./design-docs/diagram-sandboxing.md)
