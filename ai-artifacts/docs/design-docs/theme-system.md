# Theme System

> How Visualizer handles light/dark mode and why SVG diagrams are special.

## App theming

- `next-themes` toggles `.dark` on `html`.
- CSS variables in `src/app/globals.css` define palette, spacing, radius, typography.
- Tailwind v4 `@theme inline` maps custom properties to utility classes.

## Token strategy

Palette primitives (`--ivory`, `--slate`, `--clay`, etc.) are swapped in dark mode. Semantic tokens (`--background`, `--foreground`, `--primary`, `--accent`) stay stable by reference. Adapters should use semantic tokens.

## SVG diagram iframes

`svg-diagram` nodes render in a sandboxed iframe. The iframe does not inherit the parent theme class, so each diagram must include:

1. A before-paint script that reads `localStorage['visualizer-theme']`.
2. CSS variables matching the visualizer palette.
3. SVG colors driven by those variables.

See the `svg-diagram` manifest entry for the exact rules.

## Mermaid theming

Mermaid is client-rendered. The renderer injects theme classes and CSS so diagrams match light/dark mode. Mermaid config lives in `src/components/mermaid/`.
