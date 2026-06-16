---
description: "Launch six focused scout agents to interpret the deterministic fact base: codebase orientation, important components, hotspot audit, change-scenario trace, boundary audit, and testability audit."
date created: 2026-06-16T20:50:00
date modified: 2026-06-16T20:50:00
tags: ["visual-artifact", "architecture", "agentic"]
---

# Agentic workflows

These are interpretation passes. Each agent reads the deterministic digest and explores the codebase as needed. Run them after [[references/architecture-overview/deterministic-extraction|deterministic extraction]].

## How to run

Use the subagent tool to launch one scout agent per workflow. Each agent writes its report to `<repoRoot>/ai-artifacts/generated/<slug>/reports/<workflow-id>.md`.

Suggested model: `kimi/kimi-coding`.

Context to give every scout:

- deterministic digest path: `<repoRoot>/ai-artifacts/generated/<slug>/extractor-digest.md`
- repo root: `<repoRoot>`
- output report path: `<repoRoot>/ai-artifacts/generated/<slug>/reports/<workflow-id>.md`

## Workflow 1: Codebase orientation

Read the extractor digest and the codebase. Write a codebase orientation report answering: what parts of this codebase matter most for future changes, and why?

Structure your report exactly as follows:

1. Purpose of the System
2. Architectural Overview (layers, entry points, external systems)
3. Core Domain Concepts
4. Important Components (responsibility, why important, collaborators, change implications, verification path)
5. Main User / System Flows
6. Boundaries and Dependency Direction
7. Changeability Notes
8. Testing and Feedback
9. Operational and Runtime Concerns
10. Strengths, Tradeoffs, and Attention Areas
11. Recommendations
12. Summary

Pay special attention to public-facing API surfaces and key pieces of business logic. Code quality is not "clean-looking code"; it is how safely, cheaply, and confidently the system can be changed. Use neutral language like "This component is central because it coordinates X. Changes here require broad context."

## Workflow 2: Important components

Read the extractor digest and the codebase. Write an important-components report.

For each important component you find, document it through these dimensions:

- Product importance: does this component implement core business behavior?
- Change frequency: is this area likely to change often?
- Blast radius: if this changes, what else might break?
- Boundary ownership: does it separate UI, domain, data, infrastructure, external APIs?
- Complexity concentration: is this where many rules, branches, modes, or edge cases live?
- Test/verification path: how do we know changes here are safe?
- Domain language: does this code represent important business concepts?

## Workflow 3: Hotspot audit

Run a hotspot audit using git churn cross-checked with file size/complexity. Identify high-attention files.

Steps:

1. Find files that changed the most in Git history.
2. Cross-check them with file size / complexity.
3. Mark files that are both frequently changed and large or complicated.

Report scoring model for each hotspot:

- Attention point: [the finding]
- Evidence: [concrete evidence]
- Change risk: [High/Medium/Low]
- Test coverage: [current state]
- Suggested next step: [practical recommendation]
- Confidence: [High/Medium/Low]

## Workflow 4: Change-scenario trace

Implement change-scenario tracing to test locality of change.

Pick three realistic product changes for this codebase. For each change, ask and answer:

1. Where would I start?
2. How many files would I touch?
3. Is there one obvious place for the change?
4. Would UI, API, DB, and business rules all need edits?
5. Are there tests protecting this?

Report your findings focusing on shotgun surgery and change amplification risks.

## Workflow 5: Boundary audit

Inspect boundaries, dependency directions, god-modules, and side-effect mapping.

Steps:

1. Boundary inspection: trace important flows end-to-end. Look for business logic mixed with framework/UI/infrastructure code.
2. God module search: look for files named Manager, Service, Helper, Utils, Controller that lack clear cohesive responsibility.
3. Dependency direction check: do low-level details depend on high-level policy or vice versa? Are there circular dependencies?
4. Side-effect mapping: for important flows, map out where side effects (DB writes, API calls, global state) happen and if they are mixed with pure logic.

Report scoring model for each finding:

- Attention point: [the finding]
- Evidence: [concrete evidence]
- Change risk: [High/Medium/Low]
- Test coverage: [current state]
- Suggested next step: [practical recommendation]
- Confidence: [High/Medium/Low]

## Workflow 6: Testability audit

Probe testability, duplicated knowledge, complex conditionals, and abstraction usefulness.

Steps:

1. Testability probe: pick important business rules. Can they be tested without booting the full app or mocking network/DB? Are side-effects hardcoded?
2. Duplicated knowledge search: search for repeated business rules, statuses, constants, and calculations (not just duplicated code, but duplicated knowledge).
3. Complex conditional search: look for large conditionals, boolean flags, or modes that hide important domain concepts.
4. Abstraction usefulness test: identify abstractions that add indirection without reducing complexity (speculative generality).

Report scoring model for each finding:

- Attention point: [the finding]
- Evidence: [concrete evidence]
- Change risk: [High/Medium/Low]
- Test coverage: [current state]
- Suggested next step: [practical recommendation]
- Confidence: [High/Medium/Low]

## Next step

After all six reports are written, move to [[references/architecture-overview/report-director|report director]].
