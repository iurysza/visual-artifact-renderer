# Design System

> Visual direction for the renderer. The LLM does not write CSS; it picks nodes, and the renderer applies these tokens consistently.

## Identity

Visualizer artifacts should feel like a polished technical report: clear hierarchy, warm neutrals, intentional color accents, and readable data. Not a dashboard template. Not a slide deck.

## Tokens

Defined in `src/app/globals.css`:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#faf9f5` | `#151412` | page background |
| `--foreground` | `#141413` | `#f5f0e8` | primary text |
| `--card` | `#ffffff` | `#1f1e1b` | cards, panels |
| `--primary` | `--foreground` | `--foreground` | primary actions, emphasis |
| `--accent` | `#e3dacc` | `#3a332b` | highlights, soft emphasis |
| `--clay` | `#d97757` | `#e08a69` | primary accent (charts, rings, focus) |
| `--olive` | `#788c5d` | `#9faf7c` | secondary accent (success, secondary charts) |
| `--rust` | `#b04a3f` | `#ef8f86` | destructive / risk |
| `--border` | `#d1cfc5` | `#454038` | dividers, borders |

Border radius base is `0.75rem`, scaled across `sm`/`md`/`lg`/`xl`/`2xl`/`3xl`/`4xl`.

## Typography

- Sans: Geist Sans (`--font-geist-sans`)
- Mono: Geist Mono (`--font-geist-mono`)
- Serif/heading: editorial stack (`--font-editorial`)

Headings use the serif for report-like weight. Code and data use mono. Body uses sans.

## Component foundation

- shadcn/ui Base UI with custom tokens. See `components.json` (`style: base-nova`).
- Lucide icons (`lucide-react`).
- Custom primitives in `src/components/artifact-primitives.tsx` (Figure, PanelCard, TrendPill).

## Node philosophy

- Dashboard over card soup: open with a thesis, then summary tiles.
- Data gets a shape: tables, charts, and grids share normalization helpers.
- Diagrams are interactive: Mermaid has zoom/pan; SVG diagrams are sandboxed iframes.
- Status is short: status chips map short strings to badge variants.

## Design references

- shadcn skill: `/Users/iurysouza/.pi/skills/shadcn/SKILL.md` for component conventions.
- frontend-design skill: `/Users/iurysouza/.pi/agent/skills/frontend-design/SKILL.md` for distinctive UI decisions.
- Source of truth: `src/app/globals.css`, `components.json`, `src/lib/artifact-manifest.ts`.
