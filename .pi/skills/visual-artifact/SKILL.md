---
name: visual-artifact
description: |
  Generate a visual artifact report from a codebase using a multi-pass pipeline.
  Triggers deterministic extraction, agentic report workflows, report direction,
  visualization strategy, final assembly, and artifact creation.
  Result is a shareable visual artifact page.
  Activate when the user wants to create a code architecture report, codebase overview,
  visual explainer, or any visual artifact from project analysis.
user-invocable: false
---

# Visual Artifact Generator

## When to activate

Use this skill when the user wants to:
- Generate a visual artifact report from a codebase
- Create a code architecture overview or explainer
- Build a visual summary of a project's structure, risks, or important components
- Understand a codebase through a polished visual artifact

The user may say: "generate a visual artifact", "create a code report",
"visualize this codebase", "architecture report", or similar.

## Pipeline overview

The pipeline is a **6-step serial flow**. Do not skip steps. Do not reorder steps.
Each step produces files that the next step consumes.

Steps 1-2 are deterministic + agentic extraction. Steps 3-5 are agentic passes. Step 6 is the agent calling `create_visual_artifact`.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Deterministic  │───▶│  Agentic Report │───▶│  Report Director│
│  Extraction     │    │  Workflows      │    │  (Editorial)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────┐
                                            │  Visualization  │
                                            │  Strategy       │
                                            └─────────────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────┐
                                            │  Final Assembly │
                                            │  (JSON spec)    │
                                            └─────────────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────┐
                                            │  create_visual  │───▶│  Shareable page │
                                            │  _artifact      │    │  (validated)    │
                                            └─────────────────┘    └─────────────────┘
```

## Step-by-step instructions

### Step 1 & 2: Extraction + Agentic reports

**Quick run (both together):**
```bash
pnpm extract:all
```

This runs deterministic extraction followed by agentic report workflows in one shot.

**Or run separately for granular control:**

**Step 1: Deterministic extraction**
```bash
pnpm extract
```

This executes a batch of cheap deterministic probes (dependency-cruiser, knip, ast-grep, jscpd) and produces:

- `ai-artifacts/generated/<slug>/extractor-digest.md` — LLM-oriented summary
- `ai-artifacts/generated/<slug>/extractor-run.json` — tool inventory
- `ai-artifacts/generated/<slug>/packets/*.json` — structured fact packets
- `ai-artifacts/generated/<slug>/reports/*.md` — human-readable reports
- `ai-artifacts/generated/<slug>/assets/*` — raw tool outputs, Mermaid graphs

The slug defaults to the project directory name. Pass a custom slug if needed:
`pnpm extract <repoRoot> <slug>`.

**Step 2: Agentic report workflows**
```bash
pnpm extract:agentic
```

This launches subagent scouts for focused report workflows:
- codebase-orientation
- important-components
- hotspot-audit
- change-scenario-trace
- boundary-audit
- testability-audit

Each workflow reads the deterministic digest and writes a free-flow markdown report.

**Output:** More files in `ai-artifacts/generated/<slug>/reports/`.

### Step 3: Report Director

Run: `pnpm extract:director`

This launches one scout agent as the **Report Director**. It reads all packets, reports, digest, and source plan docs. It decides:

- What the artifact should teach (thesis)
- Who it's for (audience)
- Section order and emphasis
- Which packets feed which sections
- Suggested component types per section

**Output:**
- `ai-artifacts/generated/<slug>/report-direction.json` — structured brief
- `ai-artifacts/generated/<slug>/report-direction.md` — human-readable storyboard

**Rules enforced:**
- Orientation-first, not remediation-first
- "Attention area" means "important place to understand", not "bad code"
- Recommendations are trailing/minor only

### Step 4: Visualization Strategy

Run: `pnpm extract:visualization`

This launches one scout agent as the **Visualization Art Director**. It reads:
- Report direction
- Packets and reports
- Artifact component palette/manifest
- Source plan docs

It writes an open-ended Markdown brief suggesting how to visualize the information:
- Page rhythm and composition
- Component ideas per section
- Evidence display strategy
- Diagram and table opportunities

**Output:**
- `ai-artifacts/generated/<slug>/visualization-strategy.md`

**Rules enforced:**
- Markdown only — no typed schema
- Not deterministic — just thinking/planning
- Not final `VisualArtifactSpec`

### Step 5: Final Assembler

Run: `pnpm extract:assembler`

This launches one scout agent as the **Final Assembler**. It reads all context (direction, strategy, packets, reports, digest, component palette) and writes:

- `ai-artifacts/generated/<slug>/visual-artifact-spec.json`

This is the **validated `VisualArtifactSpec` JSON** that the parent agent will feed to `create_visual_artifact`.

**Rules enforced:**
- The assembler **does not** call `create_visual_artifact`
- It writes JSON to disk
- The JSON is validated against `VisualArtifactSpecSchema` before being saved

### Step 6: Create the visual artifact

Read the generated JSON spec:
- `ai-artifacts/generated/<slug>/visual-artifact-spec.json`

Call the `create_visual_artifact` tool with that JSON payload.

**If validation fails:**
1. Read the error message from the tool failure
2. Fix the JSON spec (edit nodes, fix data keys, correct schema issues)
3. Call `create_visual_artifact` again
4. Repeat until the tool succeeds

**Why this works:** `create_visual_artifact` validates against `VisualArtifactSpecSchema`. If it fails, the error tells the agent exactly what's wrong. The agent fixes it and retries. This is the natural Pi tool loop.

**Do not** call `create_visual_artifact` before the assembler has produced the JSON file.

## Generated artifact directory

All intermediate and final outputs live under:

```
ai-artifacts/generated/<slug>/
├── extractor-digest.md
├── extractor-run.json
├── packets/
│   ├── repo-profile.json
│   ├── dependency-cruiser.json
│   └── ...
├── reports/
│   ├── codebase-orientation.md
│   ├── important-components.md
│   └── ...
├── assets/
│   ├── dependency-cruiser.json
│   └── ...
├── report-direction.json
├── report-direction.md
├── visualization-strategy.md
└── visual-artifact-spec.json   ← final spec fed to create_visual_artifact
```

## Critical rules

1. **Never call `create_visual_artifact` from inside a script.** Only the parent agent (you) calls it after reading the JSON spec.
2. **Never skip the Report Director.** The director steers the narrative. Without it, the artifact becomes generic.
3. **Never skip the Visualization Strategy.** The strategy tells the assembler how to visualize, not just what to say.
4. **Orientation-first, always.** The artifact informs — it does not scold or prescribe.
5. **Evidence-backed, always.** Every claim should trace back to a packet or report.
6. **Use only supported node types.** The artifact component palette is in `src/lib/artifact-manifest.ts`.
7. **Put data in `data` and reference by `dataKey`.** Don't inline large arrays in nodes.

## Artifact component palette reference

When calling `create_visual_artifact`, use only these node types:

- `heading`, `text`, `card`, `metric`, `stat-card`, `badge`, `button`, `separator`
- `table`, `data-table`, `comparison-table`, `chart`
- `mermaid`, `svg-diagram`, `flow`, `timeline`, `code-block`, `status-grid`
- `grid`, `section`, `tabs`, `accordion`

Read `src/lib/artifact-manifest.ts` for full descriptions, props, and examples.

## Troubleshooting

**If `pnpm extract` fails:** Check that dependency-cruiser, knip, ast-grep, and jscpd are installed globally or in the project. Run `pnpm install` first.

**If the Report Director produces empty/short output:** Check that `ai-artifacts/generated/<slug>/packets/` and `reports/` are populated after Step 1.

**If the Final Assembler produces invalid JSON:** The assembler script validates against `VisualArtifactSpecSchema` and will throw. You may need to manually fix the JSON or re-run the assembler.

**If `create_visual_artifact` fails validation:** Read the error, fix the JSON, retry. Common issues:
- Missing `data` key referenced by a node
- Invalid node type
- `items` array too short for `flow` or `tabs`
- `slug` not in kebab-case

## Mental model

Code quality is not "clean-looking code." It is how safely, cheaply, and confidently the system can be changed.

Every visual artifact report should answer:

> Where is future change risky, expensive, or hard to understand, and what evidence shows it?

The report should avoid vague judgment. Use neutral, evidence-backed language:
- "This component is central because it coordinates X, Y, and Z."
- "Changes here require broad context and careful regression testing."
- "This file is high-attention because it combines high churn, size, and partial test coverage."
