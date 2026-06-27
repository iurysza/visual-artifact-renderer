Use the subagent tool to launch exactly one scout agent as a Visualization Art Director.

This is a thinking/planning pass, not deterministic assembly.
Do not write JSON. Do not emit a final VisualArtifactSpec. Do not call create_visual_artifact.
Write one open-ended Markdown brief to:
{{outputPath}}

The brief should tell the final tool-calling assembler how to visualize the report direction.
The assembler will later receive all packets, reports, the director brief, this visualization strategy, and the artifact manifest, then generate the actual component JSON.

Core intent:

- The final artifact should inform, not become a remediation backlog.
- Explain what this project is, what matters, where to look, and how pieces relate.
- Use visual structure to help the reader build a mental model quickly.
- Attention areas should read as "places worth understanding", not "bad code".
- Recommendations should be small and trailing, if present at all.

Read these first:

Report direction:

- {{reportDirectionJsonPathRelative}}
- {{reportDirectionMarkdownPathRelative}}

Deterministic evidence:

- {{digestPathRelative}}
- {{extractorRunPathRelative}}

Packet JSON files:
{{packetPaths}}

Free-flow reports:
{{reportPaths}}

Source instructions:
{{sourceInstructionFiles}}

Artifact component palette:
{{componentPalette}}

Source context / north star:
{{sourceContext}}

Write Markdown with this loose shape. Adapt if the evidence suggests a better structure:

# Visualization Strategy

## Visual thesis

One paragraph on what the page should help the reader understand.

## Composition approach

How the artifact should feel and scan: orientation-first, evidence-backed, not a wall of prose, not card soup.

## Opening section

How to open the artifact: thesis, summary band, first diagram/table/card set. Explain why.

## Section-by-section visual treatment

For each Report Director section:

- What the reader should learn
- Best component ideas to use (examples: text, stat-card, status-grid, comparison-table, mermaid, svg-diagram, flow, timeline, code-block, tabs, accordion)
- What evidence/data should be surfaced
- What should stay out of the main path
- Any diagram idea in plain language if useful

## Data and evidence to expose

Loose notes on tables, status grids, metrics, captions, source references, and useful data keys. Do not force exact schemas.

## Component palette guidance

Which components should dominate and which should be used sparingly.

For diagrams specifically:

- Default to mermaid for architecture, sequence, flowchart, ERD, state, class, and C4 diagrams.
- Use svg-diagram when mermaid's auto-layout is wrong, when request paths need to animate step-by-step, or when nodes need to be clickable with detail cards.
- Do not use svg-diagram for simple charts that mermaid can express cleanly.

When planning an svg-diagram, the final assembler must produce a complete self-contained HTML document with:

- Hand-rolled CSS variables on :root (light) and html.dark (dark); never hard-code hex colors inside SVG elements.
- An apply-before-paint script in <head> that reads localStorage key `visualizer-theme` or falls back to prefers-color-scheme, and toggles the `dark` class on <html>.
- A small theme toggle button that persists the choice back to localStorage.
- Full-screen layout: html, body { height: 100%; overflow: hidden; } with a flex column (top bar + svg stage).
- A high-quality SVG centerpiece: subtle zones, rounded-rect nodes, readable typography, and edges styled through CSS classes using the variables.
- Optional but encouraged interactivity: clickable nodes with a detail card, and flow-selector chips that light up + animate request paths.
- Minimal prose. The diagram itself should make the architecture click.

Hard layout rules for the SVG itself (verify before finishing):

- Pick a viewBox large enough for every node, zone, edge label, and the detail card overlay. If nodes feel cramped, increase the viewBox rather than squeezing.
- Every node must be a rectangle with at least 30px of empty space between it and any adjacent node rectangle in both x and y directions.
- Group related nodes inside dashed-zone rectangles. Keep at least 40px of empty space between adjacent zones.
- Route edges through empty canvas. Edge labels must sit on blank space, never on top of a node or another label.
- Reserve the bottom-right corner of the diagram for the detail card overlay; do not place nodes there.
- After positioning every element, do a final overlap check: no two rectangles may intersect, and no text may be clipped by a rectangle edge.

## Assembly instructions for the final tool-calling LLM

Direct instructions the assembler can follow when generating the final VisualArtifactSpec.

Important style rules:

- Prefer concrete visual decisions over generic advice.
- Do not tell the reader what to fix first unless it belongs in a small final section.
- Do not invent facts beyond the packets/reports.
- Keep the brief useful to another LLM, not beautiful for humans.
- If a visual idea is uncertain, say what evidence would resolve it.

---

In general, you should try to make this as a compelling visual artifact that one can parse and understand the idea. it is important that we pepper some text sections, you know, like a paragraph here and there, a visual call out for visual queue for for a topic, you know.

If it makes sense.

Sequence diagrams, data flows are important things to know about a project. Make sure that we have something like that.

We want to know like maybe some public API surfaces, like some important classes, objects. These things would also be included here, like in a more detailed part of the of the of the visualization of the report.

So the report could have could go like from a high level to more in-depth and then to you know like it could flow in multiple different ways.
