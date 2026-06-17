# Diagram Sandboxing

> How Visualizer contains diagram rendering.

## Mermaid

- Renders client-side from text definitions.
- Supports zoom, pan, fit, keyboard controls.
- Large diagrams can time out; `pnpm validate:mermaid` checks syntax.
- Safe because input is text, not executable code.

## SVG diagram

- Renders arbitrary HTML/SVG inside a sandboxed iframe.
- Used when Mermaid cannot express the desired diagram.
- Sandboxing prevents scripts in the diagram from accessing the parent page.
- Diagrams must bring their own theme script and CSS variables.

## Containment rule

The LLM never emits raw JSX or CSS for the main renderer. Diagrams are the only escape hatch, and only under strict sandbox + theme contracts.
