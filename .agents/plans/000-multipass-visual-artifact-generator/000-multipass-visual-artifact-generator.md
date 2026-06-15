---
name: 000-multipass-visual-artifact-generator
description: Integrate a layered multi-pass visual artifact generator where agentic workflows produce structured report packets that the assembler turns into the final artifact.
steps:
  - phase: source consolidation
    steps:
      - "- [ ] step 1: treat idea.md, mental-model.md, code-base-report-guidelines.md, and hotspot-audit-algorithm.md as source instructions for v1 report workflows"
      - "- [ ] step 2: preserve the central lens: code quality means safe, cheap, confident change, not pretty code"
      - "- [ ] step 3: map each source idea to a workflow report packet consumed by the final assembler"
  - phase: report packet contract
    steps:
      - "- [ ] step 1: define the report packet schema for facts, findings, evidence, assets, confidence, and assembly hints"
      - "- [ ] step 2: persist every packet and generated asset under ai-artifacts/generated/<slug>/"
      - "- [ ] step 3: require workflow runners to emit reports only, never the final VisualArtifactSpec"
  - phase: extension contract
    steps:
      - "- [ ] step 1: keep create_visual_artifact as the final low-level writer/validator"
      - "- [ ] step 2: add composable planning, extraction, report-running, assembly, and validation tools in the same visual-artifact extension"
      - "- [ ] step 3: design tool outputs so the call site receives the plan, report packets, deterministic facts, Mermaid assets, data tables, and assembly instructions"
      - "- [ ] step 4: add a high-level skill/command workflow that calls the composable tools in order"
      - "- [ ] step 5: update extension promptGuidelines to require report-packet multi-pass generation for complex artifacts"
  - phase: router and planner
    steps:
      - "- [ ] step 1: implement a router that chooses code-architecture first, later explainer, data-dashboard, and runbook"
      - "- [ ] step 2: make the planner choose required deterministic extractors and agentic report workflows"
      - "- [ ] step 3: make the planner return target audience, sections, node types, data keys, report packet IDs, graph ideas, and assembly order"
  - phase: deterministic extractor packets
    steps:
      - "- [ ] step 1: implement repo profile extraction: package manager, framework, scripts, deps, entry points, tests, routes"
      - "- [ ] step 2: implement folder/layer extraction with ignored directory pruning"
      - "- [ ] step 3: implement internal import/dependency graph extraction"
      - "- [ ] step 4: implement package dependency grouping"
      - "- [ ] step 5: emit compact JSON facts, tables, Mermaid graphs, and report packets under ai-artifacts/generated/<slug>/"
      - "- [ ] step 6: add validation fixtures for at least this repo"
  - phase: codebase orientation workflows
    steps:
      - "- [ ] step 1: implement the codebase orientation report workflow: purpose, architecture overview, domain concepts, important components, flows, boundaries, testing, runtime concerns, tradeoffs, recommendations"
      - "- [ ] step 2: implement the important-component workflow using product importance, change frequency, blast radius, boundary ownership, complexity concentration, test path, and domain language"
      - "- [ ] step 3: require neutral language: report importance, change risk, evidence, and verification paths instead of calling code bad"
  - phase: hotspot and change-risk workflows
    steps:
      - "- [ ] step 1: implement hotspot audit: git churn plus size/complexity to find high-attention files"
      - "- [ ] step 2: implement change-scenario tracing for three realistic product changes"
      - "- [ ] step 3: implement boundary inspection, dependency-direction check, god-module search, and side-effect mapping"
      - "- [ ] step 4: implement testability, duplicated-knowledge, complex-conditional, and abstraction-usefulness probes"
      - "- [ ] step 5: score every attention point with evidence, why it matters, change risk, test coverage, next step, and confidence"
  - phase: section generation protocol
    steps:
      - "- [ ] step 1: update the visual-artifact skill with router, planner, report packet, section, and assembler instructions"
      - "- [ ] step 2: define code architecture artifact sections: overview, domain concepts, technical layers, integration points, runtime flow, data boundaries, change-risk map, testing confidence, tradeoffs, recommendations"
      - "- [ ] step 3: require each section pass to consume only the plan plus selected report packets and output ArtifactNode[] plus optional data patches"
      - "- [ ] step 4: allow independent section passes to run serially in v1 and parallelize only after packet contracts are stable"
      - "- [ ] step 5: add compact examples for planner output, report packets, section output, and final spec assembly"
  - phase: assembly and validation
    steps:
      - "- [ ] step 1: merge report packets, deterministic facts, generated assets, and section specs into one VisualArtifactSpec"
      - "- [ ] step 2: validate final spec against artifact-schema and extension validator limits"
      - "- [ ] step 3: run Mermaid validation for generated diagrams"
      - "- [ ] step 4: verify every report packet referenced by the final artifact exists on disk"
      - "- [ ] step 5: call create_visual_artifact only after schema, asset, packet, and diagram validation pass"
  - phase: docs and examples
    steps:
      - "- [ ] step 1: add one complete code architecture example artifact generated from report packets"
      - "- [ ] step 2: document generator lifecycle, call-site responsibilities, and tool responsibilities"
      - "- [ ] step 3: document when to use deterministic extractors, agentic report workflows, section passes, and LLM-only sections"
      - "- [ ] step 4: document the code-quality mental model and hotspot algorithms as reusable workflow instructions"
  - phase: future expansion
    steps:
      - "- [ ] step 1: add optional ARCHITECTURE.md update mode after visual artifact generation works"
      - "- [ ] step 2: add generic explainer generator after code architecture is stable"
      - "- [ ] step 3: add data dashboard generator after extractor and packet protocols stabilize"
      - "- [ ] step 4: evaluate SDK/subagent parallel report and section generation only after serial workflow works"
---

# 000-multipass-visual-artifact-generator

## Outcome

Integrate a layered multi-pass generator into the existing `visual-artifact` extension. The frontend renderer stays stable. The extension/skill layer becomes responsible for routing, planning, deterministic extraction, agentic report workflows, section generation, assembly, validation, and final artifact creation.

The important change: intermediate agents do **not** directly build the final page. They run focused workflows and emit structured **report packets**. The call site receives those packets, facts, diagrams, and assembly hints. A final assembler model uses that evidence to build the visual artifact spec and then calls `create_visual_artifact`.

## Source ideas integrated

The files in this folder become reusable workflow instructions, not loose notes.

| Source | Integrated role |
| --- | --- |
| `idea.md` | Captures the original intent: use code-quality literature and practical review heuristics to create useful reports about important codebase areas. |
| `mental-model.md` | Defines the shared quality lens: code quality is the ability to change software safely, cheaply, and confidently. |
| `code-base-report-guidelines.md` | Defines the codebase orientation and changeability report structure. |
| `hotspot-audit-algorithm.md` | Defines concrete workflows for finding high-attention areas: hotspots, boundaries, dependency direction, testability, duplication, side effects, and abstraction usefulness. |

These workflows should generate reports. Those reports become input evidence for the visual artifact assembler.

## Core mental model

Code quality is not “clean-looking code.” It is how safely, cheaply, and confidently the system can be changed.

Every v1 code architecture report should answer:

> Where is future change risky, expensive, or hard to understand, and what evidence shows it?

The report should avoid vague judgment like “this code is bad.” Use neutral, evidence-backed language:

- “This component is central because it coordinates checkout, payment validation, persistence, and external provider calls.”
- “Changes here require broad context and careful regression testing.”
- “This file is high-attention because it combines high churn, size, complexity, and partial test coverage.”

## Architecture decision

Use one extension, not a second extension. Keep `create_visual_artifact` as the final stable write/validate tool. Add generator/planner/extractor/report/assembler capabilities next to it inside the current visual artifact extension.

Use a **hybrid v1 API**: expose small composable tools for debugging and reuse, then drive them through a high-level skill/command workflow.

Composable tools:

- `plan_visual_artifact`
- `extract_visual_artifact_facts`
- `run_visual_artifact_report_workflow`
- `assemble_visual_artifact_spec`
- `validate_visual_artifact_spec`
- existing `create_visual_artifact`

Workflow entrypoint:

- skill/command-level `generate_visual_artifact` flow that calls the composable tools in order.

The key split:

- **Frontend renderer**: stable JSON → page renderer. Minimal schema/UI churn.
- **Extension**: tools that save artifacts, run deterministic extractors, run report workflows, assemble, and validate.
- **Skill/prompt layer**: context engineering, routing, planner protocol, report packet protocol, section protocol, assembly rules.
- **Deterministic scripts**: repo facts, folder trees, dependency graphs, package graphs, Mermaid graph output.
- **Agentic workflow runners**: focused report generators that consume instructions plus deterministic outputs and emit structured report packets.

## Report packet model

A report packet is the contract between a focused workflow and the final assembler.

Each packet should be persisted under:

```text
ai-artifacts/generated/<slug>/packets/<packet-id>.json
ai-artifacts/generated/<slug>/reports/<packet-id>.md
ai-artifacts/generated/<slug>/assets/*
```

Suggested packet shape:

```ts
type VisualArtifactReportPacket = {
  id: string
  kind:
    | "repo-profile"
    | "folder-layers"
    | "dependency-graph"
    | "codebase-orientation"
    | "important-components"
    | "hotspot-audit"
    | "change-scenario-trace"
    | "boundary-audit"
    | "testability-audit"
    | "recommendations"
  title: string
  summary: string
  instructionsSource: string[]
  facts: Record<string, unknown>
  findings: Array<{
    title: string
    evidence: string[]
    whyItMatters: string
    changeRisk?: "low" | "medium" | "high"
    testCoverage?: string
    suggestedNextStep?: string
    confidence: "low" | "medium" | "high"
  }>
  dataPatches?: Record<string, unknown[]>
  assets?: Array<{
    type: "mermaid" | "json" | "text" | "table"
    path: string
    title: string
    description?: string
  }>
  assemblyHints?: Array<{
    section: string
    suggestedNodeTypes: string[]
    priority: "primary" | "secondary"
  }>
  unresolvedQuestions?: string[]
}
```

Rules:

- A workflow runner emits report packets only.
- A workflow runner must not call `create_visual_artifact`.
- A workflow runner must cite concrete evidence: files, commands, graph edges, tests, imports, package metadata, or repo facts.
- A workflow runner can suggest node types and data patches, but the assembler owns the final `VisualArtifactSpec`.
- Packets are saved by default for debugging, review, and repeatable assembly.

## V1 pipeline

1. **Router** decides generator type: `code-architecture`, later `explainer`, `data-dashboard`, `runbook`.
2. **Planner pass** returns the visualization plan: audience, sections, node types, data keys, extractors needed, report workflows needed, diagram ideas, packet IDs, assembly order.
3. **Deterministic extractor pass** runs scripts/tools and emits fact packets plus generated assets.
4. **Agentic report workflow pass** runs focused instructions against deterministic facts and source snippets; each workflow emits one report packet.
5. **Section generation pass** consumes selected report packets and writes `ArtifactNode[]` plus optional `data` patches.
6. **Assembler pass** merges deterministic facts, report packets, generated assets, and section specs into one `VisualArtifactSpec`.
7. **Validation pass** checks schema, extension limits, packet references, asset existence, Mermaid syntax, and renderer compatibility.
8. **Writer pass** calls `create_visual_artifact` and returns the URL.

## Call-site contract

The call site should receive an intermediate context object before final assembly:

```ts
type GeneratedArtifactContext = {
  slug: string
  generatorType: "code-architecture" | "explainer" | "data-dashboard" | "runbook"
  planPath: string
  packetPaths: string[]
  reportPaths: string[]
  assetPaths: string[]
  assemblyInstructions: string
}
```

The assembler model uses this context as its source of truth. It should not re-investigate everything from scratch unless a packet declares missing evidence.

## V1 vertical slice: code architecture report

Start with code architecture because deterministic extraction clearly helps and the source notes already define strong report workflows.

Generated artifact should include:

- System overview
- Purpose of the system
- Major components and responsibilities
- Core domain concepts
- Technical layers
- Integration points: APIs, queues, external services
- Runtime flow: request paths, jobs, workers
- Data flow paths
- Data boundaries and transformations
- Boundaries and dependency direction
- Change-risk map
- Testing and feedback confidence
- Operational/runtime concerns
- Strengths, tradeoffs, and attention areas
- Recommendations
- Dependency/package/folder diagrams where useful

Generated deterministic outputs:

- `facts.json`: framework, package manager, scripts, deps, routes, entry points, components, test commands
- `folder-tree.txt`: compact pruned tree
- `internal-imports.json`: source file/module import edges
- `package-deps.json`: package dependency groups
- `dependency-graph.mmd`: Mermaid graph for important code boundaries
- `runtime-flow.mmd`: Mermaid flow when entry points are detectable

Generated agentic report packets:

- `codebase-orientation`: purpose, architecture overview, domain concepts, flows, runtime concerns
- `important-components`: components ranked by product importance, change frequency, blast radius, boundary ownership, complexity concentration, verification path, and domain language
- `hotspot-audit`: churn plus size/complexity; top high-attention files/components
- `change-scenario-trace`: three realistic product changes and expected files/areas touched
- `boundary-audit`: UI/domain/data/infrastructure separation and dependency direction
- `testability-audit`: test seams, hardcoded side effects, feedback paths, coverage confidence
- `knowledge-duplication-audit`: repeated business rules, constants, statuses, validations, and calculations
- `side-effect-map`: database writes, network calls, file writes, analytics, global state, time/randomness, cache mutation
- `abstraction-usefulness-audit`: useful abstractions vs unnecessary indirection/speculative generality
- `recommendations`: ranked, practical next steps based on evidence from the other packets

## Codebase orientation workflow instructions

This workflow produces the main orientation report packet.

Use this structure:

1. **Purpose of the system** — product/business capability and core outcome.
2. **Architectural overview** — main apps/modules/packages, entry points, layers, external systems, data sources, runtime assumptions.
3. **Core domain concepts** — meaning, code locations, importance, rules that depend on each concept.
4. **Important components** — responsibility, why important, collaborators, change implications, verification path.
5. **Main user/system flows** — trigger, steps, components, data changed, external calls, failure cases, tests.
6. **Boundaries and dependency direction** — UI vs business logic, domain vs infrastructure, internal vs external, pure logic vs side effects.
7. **Changeability notes** — common change types, areas touched, complexity, notes.
8. **Testing and feedback** — unit/integration/e2e/manual/CI/lint/type/observability confidence.
9. **Operational and runtime concerns** — config, env vars, feature flags, migrations, services, jobs, queues, caching, logging, deployment.
10. **Strengths, tradeoffs, attention areas** — neutral framing.
11. **Recommendations** — practical, evidence-backed next steps.
12. **Summary** — where the system is easiest to change, where changes get complex, and which components matter most.

## Important-component workflow dimensions

For each important component, answer through these lenses:

| Lens | Question |
| --- | --- |
| Product importance | Does this component implement core business behavior? |
| Change frequency | Is this area likely to change often? |
| Blast radius | If this changes, what else might break? |
| Boundary ownership | Does it separate UI, domain, data, infrastructure, external APIs? |
| Complexity concentration | Is this where many rules, branches, modes, or edge cases live? |
| Test/verification path | How do we know changes here are safe? |
| Domain language | Does this code represent important business concepts? |

Output a report packet with ranked components, evidence, confidence, and assembly hints for tables/cards/diagrams.

## Hotspot and change-risk workflow instructions

These workflows should answer:

> Where is change risky, expensive, or hard to understand?

Run these probes:

1. **Hotspot algorithm** — find files with high git churn; cross-check with size/complexity.
2. **Change-scenario tracing** — pick three realistic product changes and estimate locality of change.
3. **Boundary inspection** — trace important flows end-to-end and detect business logic in UI/framework/infrastructure code.
4. **God object/module search** — inspect large `Manager`, `Service`, `Helper`, `Utils`, `Controller`, `Handler`, `Processor`, `Repository` modules for low cohesion.
5. **Dependency direction check** — detect circular/inverted dependencies and core logic depending on infrastructure details.
6. **Testability probe** — check if important business rules can be tested without full app/database/network/time.
7. **Duplication of knowledge search** — find repeated rules, statuses, constants, validation, permission checks, calculations.
8. **Complex conditional search** — find hidden domain concepts in repeated branches, boolean flags, mode parameters, large switches.
9. **Side-effect mapping** — map database writes, API calls, file writes, analytics, global state, time/randomness, cache mutation, UI state.
10. **Abstraction usefulness test** — identify abstractions that reduce complexity vs abstractions that add indirection without current value.

Each attention point must use this shape:

```text
Attention point:
Evidence:
Why it matters:
Change risk:
Test coverage:
Suggested next step:
Confidence:
```

Ranking rule:

> Rank findings by future change risk, not ugliness.

## Section generation protocol

A section pass should be small and bounded. It receives:

- the planner output
- selected report packet paths
- selected asset paths
- the artifact manifest
- the exact target section

It returns only:

```ts
type SectionResult = {
  sectionId: string
  nodes: ArtifactNode[]
  dataPatches?: Record<string, unknown[]>
  sourcePacketIds: string[]
  warnings?: string[]
}
```

Rules:

- Do not reread the whole repo unless the packet says evidence is missing.
- Do not invent facts not present in packets.
- Prefer `stat-card`, `status-grid`, `comparison-table`, `timeline`, `flow`, `mermaid`, and `data-table` over prose walls.
- Use neutral, evidence-backed language.
- Keep primary conclusions visible; do not hide them in accordions.

## Assembly protocol

The assembler owns the final artifact spec.

Inputs:

- planner output
- all report packets
- all section results
- deterministic data files
- Mermaid assets
- artifact manifest

Responsibilities:

- choose final page order
- merge `dataPatches`
- insert generated Mermaid diagrams
- deduplicate repeated findings
- preserve source packet references in captions or supporting tables when useful
- enforce schema and node limits
- validate diagrams before calling the writer
- call `create_visual_artifact` only after validation succeeds

## Phase 1 — Source consolidation

- [ ] step 1: treat idea.md, mental-model.md, code-base-report-guidelines.md, and hotspot-audit-algorithm.md as source instructions for v1 report workflows
- [ ] step 2: preserve the central lens: code quality means safe, cheap, confident change, not pretty code
- [ ] step 3: map each source idea to a workflow report packet consumed by the final assembler

## Phase 2 — Report packet contract

- [ ] step 1: define the report packet schema for facts, findings, evidence, assets, confidence, and assembly hints
- [ ] step 2: persist every packet and generated asset under ai-artifacts/generated/<slug>/
- [ ] step 3: require workflow runners to emit reports only, never the final VisualArtifactSpec

## Phase 3 — Extension contract

- [ ] step 1: keep create_visual_artifact as the final low-level writer/validator
- [ ] step 2: add composable planning, extraction, report-running, assembly, and validation tools in the same visual-artifact extension
- [ ] step 3: design tool outputs so the call site receives the plan, report packets, deterministic facts, Mermaid assets, data tables, and assembly instructions
- [ ] step 4: add a high-level skill/command workflow that calls the composable tools in order
- [ ] step 5: update extension promptGuidelines to require report-packet multi-pass generation for complex artifacts

## Phase 4 — Router and planner

- [ ] step 1: implement a router that chooses code-architecture first, later explainer, data-dashboard, and runbook
- [ ] step 2: make the planner choose required deterministic extractors and agentic report workflows
- [ ] step 3: make the planner return target audience, sections, node types, data keys, report packet IDs, graph ideas, and assembly order

## Phase 5 — Deterministic extractor packets

- [ ] step 1: implement repo profile extraction: package manager, framework, scripts, deps, entry points, tests, routes
- [ ] step 2: implement folder/layer extraction with ignored directory pruning
- [ ] step 3: implement internal import/dependency graph extraction
- [ ] step 4: implement package dependency grouping
- [ ] step 5: emit compact JSON facts, tables, Mermaid graphs, and report packets under ai-artifacts/generated/<slug>/
- [ ] step 6: add validation fixtures for at least this repo

## Phase 6 — Codebase orientation workflows

- [ ] step 1: implement the codebase orientation report workflow: purpose, architecture overview, domain concepts, important components, flows, boundaries, testing, runtime concerns, tradeoffs, recommendations
- [ ] step 2: implement the important-component workflow using product importance, change frequency, blast radius, boundary ownership, complexity concentration, test path, and domain language
- [ ] step 3: require neutral language: report importance, change risk, evidence, and verification paths instead of calling code bad

## Phase 7 — Hotspot and change-risk workflows

- [ ] step 1: implement hotspot audit: git churn plus size/complexity to find high-attention files
- [ ] step 2: implement change-scenario tracing for three realistic product changes
- [ ] step 3: implement boundary inspection, dependency-direction check, god-module search, and side-effect mapping
- [ ] step 4: implement testability, duplicated-knowledge, complex-conditional, and abstraction-usefulness probes
- [ ] step 5: score every attention point with evidence, why it matters, change risk, test coverage, next step, and confidence

## Phase 8 — Section generation protocol

- [ ] step 1: update the visual-artifact skill with router, planner, report packet, section, and assembler instructions
- [ ] step 2: define code architecture artifact sections: overview, domain concepts, technical layers, integration points, runtime flow, data boundaries, change-risk map, testing confidence, tradeoffs, recommendations
- [ ] step 3: require each section pass to consume only the plan plus selected report packets and output ArtifactNode[] plus optional data patches
- [ ] step 4: allow independent section passes to run serially in v1 and parallelize only after packet contracts are stable
- [ ] step 5: add compact examples for planner output, report packets, section output, and final spec assembly

## Phase 9 — Assembly and validation

- [ ] step 1: merge report packets, deterministic facts, generated assets, and section specs into one VisualArtifactSpec
- [ ] step 2: validate final spec against artifact-schema and extension validator limits
- [ ] step 3: run Mermaid validation for generated diagrams
- [ ] step 4: verify every report packet referenced by the final artifact exists on disk
- [ ] step 5: call create_visual_artifact only after schema, asset, packet, and diagram validation pass

## Phase 10 — Docs and examples

- [ ] step 1: add one complete code architecture example artifact generated from report packets
- [ ] step 2: document generator lifecycle, call-site responsibilities, and tool responsibilities
- [ ] step 3: document when to use deterministic extractors, agentic report workflows, section passes, and LLM-only sections
- [ ] step 4: document the code-quality mental model and hotspot algorithms as reusable workflow instructions

## Phase 11 — Future expansion

- [ ] step 1: add optional ARCHITECTURE.md update mode after visual artifact generation works
- [ ] step 2: add generic explainer generator after code architecture is stable
- [ ] step 3: add data dashboard generator after extractor and packet protocols stabilize
- [ ] step 4: evaluate SDK/subagent parallel report and section generation only after serial workflow works

## Non-goals for v1

- Do not expand the frontend component schema just to mirror every shadcn primitive.
- Do not build a second extension/package.
- Do not require SDK/subagent orchestration in v1.
- Do not let report workflows call `create_visual_artifact` directly.
- Do not make the tool fully autonomous before the plan/extractor/report/assembly protocol is observable.
- Do not frame codebase reports as blame or generic code smell dumps; every attention point needs evidence and change-risk framing.

## Resolved decisions

- Persist deterministic extractor outputs and report packets by default under `ai-artifacts/generated/<slug>/`.
- Keep `ARCHITECTURE.md` update mode out of core v1; add it after artifact generation works.
- Use serial report and section generation in v1; evaluate parallelism only after packet contracts are stable.

## Unresolved questions

- Which exact complexity metric should v1 use for hotspot scoring: line count only, AST-based branch count, or a small dependency-free complexity script?
- Should report packet JSON include raw evidence snippets, or only paths/line references plus the Markdown report?
