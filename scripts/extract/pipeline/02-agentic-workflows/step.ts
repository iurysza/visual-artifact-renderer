#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { loadAndRenderPrompt } from "../../lib/prompt";

const WORKFLOWS = [
  {
    id: "codebase-orientation",
    task: `Read the extractor digest and the codebase. Write a codebase orientation report answering: What parts of this codebase matter most for future changes, and why?

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


I think it's important to understand I think it's important to extract from this code base as well like very important components and like public surfacing API. Like what are the most important components, you know, like what are where are the key pieces of business logic, stuff like that. 

Remember: Code quality is not "clean-looking code." It is how safely, cheaply, and confidently the system can be changed. Avoid saying "this code is bad". Instead use neutral language like "This component is central because it coordinates X. Changes here require broad context."`,
  },
  {
    id: "important-components",
    task: `Read the extractor digest and the codebase. Write an important-components report.

For each important component you find, document it through these dimensions:
- Product importance: Does this component implement core business behavior?
- Change frequency: Is this area likely to change often?
- Blast radius: If this changes, what else might break?
- Boundary ownership: Does it separate UI, domain, data, infrastructure, external APIs?
- Complexity concentration: Is this where many rules, branches, modes, or edge cases live?
- Test/verification path: How do we know changes here are safe?
- Domain language: Does this code represent important business concepts?`,
  },
  {
    id: "hotspot-audit",
    task: `Run a hotspot audit using git churn cross-checked with file size/complexity. Identify high-attention files.

Instruction:
1. Find files that changed the most in Git history.
2. Cross-check them with file size / complexity.
3. Mark files that are both frequently changed and large or complicated.

Report scoring model for each hotspot:
Attention point: [The finding]
Evidence: [Concrete evidence]
Change risk: [High/Medium/Low]
Test coverage: [Current state]
Suggested next step: [Practical recommendation]
Confidence: [High/Medium/Low]`,
  },
  {
    id: "change-scenario-trace",
    task: `Implement change-scenario tracing to test locality of change.

Pick 3 realistic product changes for this codebase.
For each change, ask and answer:
1. Where would I start?
2. How many files would I touch?
3. Is there one obvious place for the change?
4. Would UI, API, DB, and business rules all need edits?
5. Are there tests protecting this?

Report your findings focusing on shotgun surgery and change amplification risks.`,
  },
  {
    id: "boundary-audit",
    task: `Inspect boundaries, dependency directions, god-modules, and side-effect mapping.

Instructions:
1. Boundary inspection: Trace important flows end-to-end. Look for business logic mixed with framework/UI/infrastructure code.
2. God module search: Look for files named Manager, Service, Helper, Utils, Controller that lack clear cohesive responsibility.
3. Dependency direction check: Do low-level details depend on high-level policy or vice versa? Are there circular dependencies?
4. Side-effect mapping: For important flows, map out where side effects (DB writes, API calls, global state) happen and if they are mixed with pure logic.

Report scoring model for each finding:
Attention point: [The finding]
Evidence: [Concrete evidence]
Change risk: [High/Medium/Low]
Test coverage: [Current state]
Suggested next step: [Practical recommendation]
Confidence: [High/Medium/Low]`,
  },
  {
    id: "testability-audit",
    task: `Probe testability, duplicated knowledge, complex conditionals, and abstraction usefulness.

Instructions:
1. Testability probe: Pick important business rules. Can they be tested without booting the full app or mocking network/DB? Are side-effects hardcoded?
2. Duplicated knowledge search: Search for repeated business rules, statuses, constants, and calculations. (Not just duplicated code, but duplicated knowledge).
3. Complex conditional search: Look for large conditionals, boolean flags, or modes that hide important domain concepts.
4. Abstraction usefulness test: Identify abstractions that add indirection without reducing complexity (speculative generality).

Report scoring model for each finding:
Attention point: [The finding]
Evidence: [Concrete evidence]
Change risk: [High/Medium/Low]
Test coverage: [Current state]
Suggested next step: [Practical recommendation]
Confidence: [High/Medium/Low]`,
  },
];

async function main() {
  const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
  const slug = process.argv[3] ?? path.basename(repoRoot);

  const outputDir = path.join(repoRoot, "ai-artifacts", "generated", slug);
  const digestPath = path.join(outputDir, "extractor-digest.md");
  const reportsDir = path.join(outputDir, "reports");

  await fs.mkdir(reportsDir, { recursive: true });

  console.log(`Running agentic workflows for ${slug}...`);

  const promptPath = path.join(
    path.dirname(import.meta.url).replace("file://", ""),
    "prompt.md",
  );

  for (const workflow of WORKFLOWS) {
    const reportPath = path.join(reportsDir, `${workflow.id}.md`);
    console.log(`\n--- Starting workflow: ${workflow.id} ---`);

    const prompt = await loadAndRenderPrompt(promptPath, {
      task: workflow.task,
      digestPath,
      reportPath,
    });

    try {
      execSync(`pi --print "${prompt.replace(/"/g, '\\"')}"`, {
        stdio: "inherit",
        cwd: repoRoot,
      });
      console.log(`✓ Completed: ${workflow.id}`);
    } catch (error) {
      console.error(`✗ Failed: ${workflow.id}`);
      console.error(error);
    }
  }
}

main().catch(console.error);
