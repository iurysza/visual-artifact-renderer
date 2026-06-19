---
name: Visualizer
description: A warm, precise design system for rendering agent-generated visual artifacts.
colors:
  ivory: "#faf9f5"
  paper: "#ffffff"
  slate: "#141413"
  clay: "#d97757"
  clay-dark: "#b85c3e"
  oat: "#e3dacc"
  olive: "#788c5d"
  rust: "#b04a3f"
  gray-100: "#f0eee6"
  gray-200: "#e6e3da"
  gray-300: "#d1cfc5"
  gray-500: "#87867f"
  gray-700: "#3d3d3a"
typography:
  display:
    fontFamily: "var(--font-editorial), Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "var(--font-editorial), Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.12em"
  mono:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  sm: "0.45rem"
  md: "0.6rem"
  lg: "0.75rem"
  xl: "1.05rem"
  2xl: "1.35rem"
  3xl: "1.65rem"
  4xl: "1.95rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
  3xl: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    size: "2rem"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.slate}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    size: "2rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.slate}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    size: "2rem"
  button-destructive:
    backgroundColor: "color-mix(in oklch, {colors.rust}, transparent 90%)"
    textColor: "{colors.rust}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    size: "2rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.slate}"
    rounded: "{rounded.2xl}"
    padding: "1rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.slate}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.625rem"
    size: "2rem"
---

# Design System: Visualizer

## 1. Overview

**Creative North Star: "The Drafting Table"**

A craftsman's surface: warm paper, precise tools, ink and terracotta accents. Visualizer's interface should feel like a clean, well-lit workspace where structured data is laid out for inspection. The aesthetic sits between editorial print and modern dev tool — warm enough to feel human, precise enough to trust.

The system rejects visual noise. It is not a dashboard, not a marketing site, and not a generic SaaS template. Every surface serves the artifact being rendered; chrome recedes, content dominates. Motion is stateful, not decorative. Color is restrained, not ornamental.

**Key Characteristics:**
- Warm ivory canvas with clay terracotta as the single accent voice.
- Serif display type (editorial) paired with geometric sans body and mono labels.
- Flat-by-default surfaces; shadows appear only as state responses.
- Tactile, responsive components with immediate press and focus feedback.
- Full light/dark mode support with hue-preserving palette shifts.

## 2. Colors

The palette is anchored by warm neutrals and a single terracotta accent. It reads as natural material — paper, ink, clay — rather than synthetic UI defaults.

### Primary
- **Slate (#141413)**: Primary action background, primary text, strong emphasis. Used where the interface needs to assert itself.
- **Clay (#d97757)**: The accent voice. Ring focus indicators, chart accents, hover borders, and selection states. Used sparingly so it remains meaningful.

### Secondary
- **Oat (#e3dacc)**: Secondary accent for backgrounds, highlights, and tertiary emphasis. Muted and earthy.
- **Olive (#788c5d)**: Success, positive data, secondary chart color. A desaturated natural green.

### Neutral
- **Ivory (#faf9f5)**: Default light-mode body background. Warm, slightly desaturated, easy on the eyes.
- **Paper (#ffffff)**: Card, popover, and elevated surface backgrounds.
- **Gray-100 (#f0eee6)**: Muted backgrounds, secondary surfaces, hover states.
- **Gray-300 (#d1cfc5)**: Borders, dividers, input strokes.
- **Gray-500 (#87867f)**: Muted foreground text, placeholders, secondary labels.
- **Gray-700 (#3d3d3a)**: Strong secondary text, captions.

### State
- **Rust (#b04a3f)**: Destructive actions, errors, invalid states. Applied as a tint (10–20% opacity) behind the text color.
- **Clay-dark (#b85c3e)**: Dark-mode clay variant; slightly deeper and more saturated.

### Named Rules
**The One Voice Rule.** Clay is the only accent color on UI chrome. If a second accent is needed, it should be data-driven (olive for success, rust for error), not decorative.

**The Tinted Neutral Rule.** Backgrounds carry a faint warm hue; text and borders are never pure gray. Every neutral leans toward the clay/oat family to keep the palette coherent.

## 3. Typography

**Display Font:** Editorial serif (Georgia fallback)
**Body Font:** Geist Sans (system-ui fallback)
**Label/Mono Font:** Geist Mono

**Character:** Serif display type gives headings a crafted, editorial presence; Geist Sans keeps body text and UI labels clean and technical. Mono labels add a subtle instrumentation layer.

### Hierarchy
- **Display** (500, clamp(2.25rem, 5vw, 3.75rem), 1.05 line-height): Hero headings on marketing-like surfaces or major artifact headers.
- **Headline** (500, 1.875rem, 1.1 line-height): Section titles, major artifact headings.
- **Title** (500, 1.125rem, 1.25 line-height): Card titles, sub-section headers. Sans, not serif.
- **Body** (400, 1rem, 1.6 line-height): Prose, descriptions, explanations. Capped at 65–75ch for long text.
- **Label** (500, 0.6875rem, 0.12em letter-spacing, uppercase): Metrics, badges, kicker text, button labels.
- **Mono** (400, 0.875rem, 1.5 line-height): Code, filenames, timestamps, technical metadata.

### Named Rules
**The One Display Rule.** Serif display type is reserved for page-level headings and card titles. UI labels, buttons, and data never use display serif.

**The Measure Rule.** Body text never exceeds 75ch. Data-dense tables and compact UI may run wider; prose never does.

## 4. Elevation

Surfaces are flat at rest. Depth is conveyed through tonal contrast (ivory vs. paper vs. gray-100) rather than heavy shadow. Shadows appear only as a response to state or elevation.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 10px 34px rgba(20, 20, 19, 0.06)`): Subtle ambient shadow under cards, making them read as separate sheets without lifting them off the page.
- **Theme toggle** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1)`): Small border-adjacent shadow for compact controls.

### Named Rules
**The Flat-By-Default Rule.** Surfaces sit flat. Shadows are earned by elevation, hover, or focus — never used as decoration.

## 5. Components

### Buttons
- **Shape:** Rounded-md (~9.6px radius), height 2rem (32px), padding 0 0.625rem.
- **Primary:** Slate background, ivory text. Hover darkens subtly via opacity; active presses down 1px.
- **Outline:** Paper background, slate text, gray-300 border. Hover fills with gray-100.
- **Ghost:** Transparent background. Hover fills with gray-100.
- **Destructive:** 10% rust tint background, rust text. Hover deepens to 20% tint.
- **Focus:** Clay ring (3px at 50% opacity) plus clay border.

### Cards
- **Corner Style:** Rounded-2xl (~21.6px radius).
- **Background:** Paper at 95% opacity.
- **Border:** 1.5px solid border color (gray-300).
- **Shadow:** Card rest shadow.
- **Internal Padding:** 1rem default, 0.75rem for `size="sm"`.
- **Title:** Sans title style by default; card titles specifically use serif with tight tracking.

### Inputs
- **Style:** Transparent background, gray-300 border, rounded-md.
- **Focus:** Clay border + clay ring.
- **Error:** Rust border + rust ring tint.
- **Disabled:** Input background at 50% opacity, reduced opacity text.

### Navigation
- **Site header:** Sticky top bar with blur backdrop, breadcrumb path, theme toggle.
- **Breadcrumb:** Inline path with slash separators; current page in slate, links hover to clay.
- **Theme toggle:** Rounded-full compact button, mono label, border lift on hover.

### Signature Component: Artifact Card
Artifact cards are the central container. They combine the card vocabulary with metric/label styling: a mono uppercase kicker, a serif metric, and restrained clay hover accents.

## 6. Do's and Don'ts

### Do:
- **Do** use clay as the single accent for focus, selection, and hover borders.
- **Do** keep body text within 65–75ch.
- **Do** use serif display for page headings and card titles, sans for UI and body, mono for labels.
- **Do** respect `prefers-reduced-motion` with instant or crossfade fallbacks.
- **Do** use ivory as the light-mode canvas and paper for elevated surfaces.
- **Do** maintain tactile feedback: active buttons press, focus rings glow, hover states lift subtly.

### Don't:
- **Don't** use dense dashboard noise: avoid cluttered widget grids and competing chart widgets.
- **Don't** use generic SaaS gradients or purple-blue accent palettes.
- **Don't** use overly decorative motion (bounce, elastic, purely ornamental animations).
- **Don't** nest cards inside cards as a default scaffold.
- **Don't** use side-stripe borders greater than 1px as a colored accent.
- **Don't** use gradient text or glassmorphism as a default.
- **Don't** use tiny uppercase tracked eyebrows above every section.
