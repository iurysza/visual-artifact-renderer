---
description: "Design principles for visual artifacts rendered by Visualizer. How to choose node types, structure information, and avoid generic output."
date created: 2026-06-16
date modified: 2026-06-17
tags: ["visual-artifact", "design", "ui", "guidelines"]
---

# Design guidelines for visual artifacts

These guidelines shape artifacts produced by the Visualizer renderer. The renderer turns a constrained JSON spec into a finished page — the design quality depends on the choices made inside that spec.

Treat every artifact as a small publication, not a dump of facts.

## Information first

Every artifact must be about its topic. Avoid meta-statistics such as node counts, file counts, or spec profile numbers unless they directly answer the user's question. Each heading, stat-card, and table row should move the reader closer to understanding the subject.

## Choosing node types

Match the content to the right renderer node.

Get the current node catalog from the CLI with `visual-artifact contract`, or read the source manifest in `skill/app/src/lib/artifact-manifest.ts`.

| Content | Preferred node | Why |
|---|---|---|
| Dashboard KPIs | `stat-card` inside `grid` | Hero numbers with labels and captions |
| Health / readiness board | `status-grid` | Built-in status chips and grid layout |
| Structured evidence | `table`, `data-table`, `comparison-table` | Copy-paste friendly, sortable columns |
| Flows / handoffs | `flow` | Linear visual pipeline |
| Architecture topology | `mermaid` | Automatic edge routing |
| Sequence / state / ER / class diagrams | `mermaid` | Specialized Mermaid syntax |
| Custom interactive diagrams | `svg-diagram` | When Mermaid cannot express the layout |
| Timelines | `timeline` | Date/phase markers with status |
| Long narrative | `prose` | Markdown with lists and links |
| Short callouts | `text`, `alert`, `card` | One idea at a time |
| Code examples | `code-block` | Syntax highlighting and copy button |
| Diff examples | `diff` | Side-by-side change view |
| File structure | `file-tree` | Collapsible explorer |
| Tabbed views | `tabs` | Alternate slices of the same data |
| Secondary detail | `accordion` | Keep primary content visible |

### Mermaid guidance

- Prefer `flowchart TD` for complex diagrams. Use `flowchart LR` only for simple 3–4 node linear flows.
- For state-machine labels that need colons, parentheses, or multi-line text, use `flowchart TD` with quoted edge labels instead of `stateDiagram-v2`.
- Keep Mermaid diagrams under 10–12 nodes when possible. For larger topologies, use a simple Mermaid overview plus `card`/`grid` detail sections below.
- Use `svg-diagram` when you need precise layout, clickable nodes, or a hand-rolled visual treatment.
- If a Mermaid skill is available in your environment, load it before generating or validating Mermaid diagrams.

## Content-type patterns

For concrete patterns, see [content types](./content-types/_index.md):
- [Architecture diagrams](./content-types/architecture-diagrams.md) — topology, text-heavy overviews, hybrid layouts
- [Dashboards & metrics](./content-types/dashboards.md) — KPIs, status boards, hero numbers
- [Timelines & roadmaps](./content-types/timelines.md) — phases, milestones, chronological narratives
- [Data organization](./content-types/data-organization.md) — tables, comparisons, inventories

## Layout and hierarchy

- **Lead with the thesis.** A short `text` node at the top should answer "what is this artifact about?" before any dense content.
- **Hero sections dominate.** The most important metrics or conclusions get `stat-card` tiles, large headings, and full-width placement.
- **Reference sections stay compact.** File lists, dependency inventories, and decision logs belong in tables or accordions.
- **Use sections for rhythm.** A `section` node before a dense block gives the reader a landing point.
- **Do not nest everything in cards.** If a fact fits a stat-card, status-grid item, or table row, use that instead.

## Tables over walls of text

Anytime you are about to render structured rows and columns as bullet points or paragraphs, use a table node instead:

- Feature comparisons → `comparison-table`
- Evidence lists → `data-table`
- Status reports → `status-grid` or `table`
- Configuration matrices → `table`
- API route inventories → `data-table`

Use the `statusKey` on `comparison-table` and `status-grid` to turn string values into colored chips.

## Prose accents

Use prose sparingly as an accent, not as the primary container:

- **Lead paragraph**: one `text` node with `size: "lg"` to set context.
- **Pull quote**: a `card` with `tone: "accent"` highlighting one key insight.
- **Callout box**: an `alert` for warnings, tips, or important notes.
- **Divider**: a `separator` between major sections.

When writing long-form prose, load the available writing-quality skills for your environment first.

## Anti-patterns

Avoid output that looks AI-generated:

- Generic dark dashboards with neon gradients.
- Emoji icons in headings or section labels.
- Perfectly uniform card grids with no visual hierarchy.
- Dumping entire source files into `code-block` nodes. Show structure and key snippets instead.
- Padding artifacts with meta-statistics that are not about the topic.

## The slop test

Before finishing the artifact spec, ask: **would a developer immediately think an AI generated this page?**

If the answer is yes, change one of these:

- Layout rhythm
- Information hierarchy
- Density of tables versus prose
- Specificity of examples

A distinctive artifact usually needs only one strong structural choice — an asymmetric layout, a clear hierarchy, or concrete evidence — to avoid feeling templated.

## Quality checks

Verify the artifact spec before calling `create_visual_artifact`:

- [ ] The first node answers "what am I looking at?"
- [ ] Every stat-card, table row, and diagram is about the topic, not the artifact itself.
- [ ] The most important information has the most visual weight.
- [ ] Tables are used for any structured comparison or inventory.
- [ ] Diagrams have captions and do not exceed 12 nodes unless split.
- [ ] Code blocks show structure or key snippets, not entire files.
- [ ] Secondary detail lives in `accordion` or lower sections.
- [ ] No emoji-only section headers.
