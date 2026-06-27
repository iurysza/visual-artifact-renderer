# Product

## Register

product

## Users

AI agent builders and developers. They use Visualizer to turn structured JSON output into polished visual pages — reports, code reviews, dashboards, explainers — without writing React or UI code themselves. They care about correctness, consistency, and how well the rendered page communicates the underlying data.

## Product Purpose

Visualizer is a JSON-to-UI runtime. Agents emit a constrained artifact spec; Visualizer validates it, renders known components through trusted adapters, stores artifacts locally, and serves each one at its own route. The goal is to make agent-generated visual output reliable, consistent, and good-looking by default, while keeping the agent surface small (JSON only, never React/JSX/CSS).

## Brand Personality

Technical, calm, precise.

- **Technical**: the UI should feel like a serious dev tool, not a consumer app. Information density and clarity matter more than decoration.
- **Calm**: restrained color, confident whitespace, no shouting. The interface gets out of the way so the artifact content is the focus.
- **Precise**: sharp alignment, consistent spacing, predictable typography. Every element should feel intentionally placed.

## Anti-references

- Dense dashboard noise: avoid cluttered admin-tool grids, competing chart widgets, and visual overload. Visualizer is a renderer, not a monitoring dashboard.
- Generic SaaS gradients and purple-blue accent palettes: the product should not look like a templated startup landing page.
- Overly decorative motion: no bounce, elastic, or purely ornamental animations. Motion should aid comprehension, not entertain.
- Card-heavy layouts: cards are useful only when they genuinely group related actions or information; avoid nesting cards inside cards as a default scaffold.

## Design Principles

1. **Content is the hero.** The artifact being rendered is the point; chrome should recede.
2. **Consistency through constraint.** The contract is the handshake. Agents get a small, well-defined vocabulary; the renderer enforces quality through adapters.
3. **Developer-grade credibility.** The UI should look and feel like a tool engineers trust: fast, predictable, and visually tight.
4. **Restraint over novelty.** Prefer solid, proven patterns over trendy effects. Distinctiveness comes from craft and typography, not gimmicks.
5. **Progressive disclosure.** Dense data should be scannable at a glance and explorable on demand; never dump everything at once.

## Accessibility & Inclusion

- Target WCAG 2.1 AA as a baseline.
- Respect `prefers-reduced-motion`: all motion should have an instant or crossfade fallback.
- Ensure interactive elements meet minimum touch-target sizes on smaller viewports.
- Maintain color contrast ratios: 4.5:1 for normal text, 3:1 for large text and UI components.
