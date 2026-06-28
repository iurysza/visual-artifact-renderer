# Theme System

> How Visualizer handles light/dark mode and why diagram iframes are special.

## App theming

- `next-themes` toggles `.dark` on `html`.
- CSS variables live in `skill/app/src/app/globals.css`.
- Tailwind v4 maps variables via `@theme inline`.
- Adapters should use semantic tokens through classes, not hardcoded hex values.

## Token strategy

Palette primitives (`--ivory`, `--slate`, `--clay`, `--olive`, `--rust`, etc.) change between light and dark themes. Semantic tokens (`--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--border`) stay stable by meaning.

Adapters should rely on semantic tokens unless the manifest explicitly calls for a tone such as `success`, `warning`, or `danger`.

## SVG diagram iframes

`svg-diagram` nodes render in a sandboxed iframe. The iframe does not inherit parent theme classes or CSS variables, so each diagram must include:

1. A before-paint script that reads `localStorage['visualizer-theme']` or `prefers-color-scheme`.
2. CSS variables for light and dark themes.
3. SVG styles that reference those variables through classes.
4. No hardcoded SVG fill/stroke hex values unless there is a specific reason.

## Mermaid theming

Mermaid renders client-side in `skill/app/src/components/mermaid/`. The renderer supplies theme-aware CSS and viewport controls for zoom, pan, fit, and keyboard navigation.

## Source files

- Theme tokens: `skill/app/src/app/globals.css`
- Theme provider: `skill/app/src/components/theme-provider.tsx`
- Theme toggle: `skill/app/src/components/theme-toggle.tsx`
- Mermaid renderer: `skill/app/src/components/mermaid/*`
- SVG iframe: `skill/app/src/components/svg-diagram.tsx`
