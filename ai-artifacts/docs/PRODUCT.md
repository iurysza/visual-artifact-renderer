# Product

## Product register

Visualizer is a **generative-UI, server-driven runtime for agent output**.

## Users

- AI agent builders who want richer output than markdown.
- Developers using Pi who want visual reports, code reviews, dashboards, architecture briefs, and explainers.
- Maintainers who need agent-generated pages to be consistent, reviewable, and local-first.

## Problem

HTML articles are a surprisingly effective format for explaining complex work, but asking an LLM to generate full HTML every time is wasteful and brittle.

Common failure modes:

- inconsistent styling and hierarchy
- long CSS/HTML boilerplate burning tokens
- fragile scripts/assets
- no shared validation contract
- hard-to-debug output when the model drifts

## Product purpose

Visualizer lets an agent describe a page as constrained JSON. The runtime validates that JSON, stores it locally, and renders known UI components through trusted adapters.

The product goal: **make agent-generated visual output reliable, consistent, and good-looking by default without letting the agent write arbitrary UI code.**

## Value proposition

- **Less prompt waste**: the model emits structured content, not repeated UI scaffolding.
- **More consistency**: the renderer owns typography, spacing, theme, and component behavior.
- **Safer output**: contract validation replaces arbitrary HTML/JSX generation.
- **Better reading experience**: artifacts become navigable reports, not markdown walls.
- **Local-first by default**: generated specs stay on the machine unless explicitly shared.

## Brand personality

Technical, calm, precise.

- **Technical**: a serious dev tool, not a consumer toy.
- **Calm**: restrained color, confident whitespace, no shouting.
- **Precise**: sharp alignment, predictable typography, intentional density.

## Design principles

1. **Content is the hero.** Chrome recedes; artifact content carries the page.
2. **Consistency through constraint.** Agents get a small vocabulary; adapters enforce quality.
3. **Developer-grade credibility.** The UI should feel fast, inspectable, and trustworthy.
4. **Restraint over novelty.** Distinctiveness comes from craft, not gimmicks.
5. **Progressive disclosure.** Dense data should scan first and explain on demand.

## Anti-references

- Dense admin dashboards with competing widgets.
- Generic SaaS gradients and purple-blue startup polish.
- Decorative motion that does not improve comprehension.
- Card soup: nested cards for every tiny fact.
- AI-looking pages padded with meta-statistics.

## Accessibility baseline

- Target WCAG 2.1 AA.
- Respect `prefers-reduced-motion`.
- Preserve touch targets on small screens.
- Maintain contrast: 4.5:1 for normal text, 3:1 for large text/UI controls.
