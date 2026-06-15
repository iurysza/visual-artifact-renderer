# Mermaid Diagram Validator

A linting system for Mermaid diagrams that gives structured, line-level feedback so an LLM can auto-correct bad syntax.

## Files

- `src/lib/mermaid-validator.ts` — core validator
- `scripts/validate-mermaid.ts` — CLI
- `scripts/test-mermaid-validator.ts` — demo test cases

## CLI

```bash
# validate a file
pnpm validate:mermaid diagram.mmd

# validate inline
pnpm validate:mermaid --inline "flowchart TD\n  A --> B"

# JSON output for tooling
pnpm validate:mermaid --json diagram.mmd

# quiet mode (exit code only)
pnpm validate:mermaid --quiet diagram.mmd
```

## Library

```typescript
import { validateMermaid, formatValidationReport } from "@/lib/mermaid-validator";

const result = await validateMermaid(`flowchart TD\n  A -- B`);
console.log(result.valid);   // false
console.log(result.errors);  // [{ line, column, rule, message, suggestion }]
console.log(formatValidationReport(result));
```

## LLM auto-loop pattern

```typescript
async function generateValidDiagram(prompt: string): Promise<string> {
  let diagram = await llm.generate(prompt);
  for (let i = 0; i < 3; i++) {
    const result = await validateMermaid(diagram);
    if (result.valid) return diagram;
    diagram = await llm.generate(
      `Fix this Mermaid diagram. Errors:\n${formatValidationReport(result)}\n\nDiagram:\n${diagram}`
    );
  }
  throw new Error("Could not generate a valid diagram");
}
```

## Rules checked

| Rule | Severity | Description |
|------|----------|-------------|
| `frontmatter-closed` | error | `---` frontmatter must be closed with `---` |
| `missing-diagram-type` | error | first non-comment line must declare a diagram type |
| `unknown-diagram-type` | error | diagram type is not in the supported list |
| `class-brace-unbalanced` | error | class block has unbalanced `{` / `}` |
| `flowchart-invalid-link` | error | `A -- B` is not a valid link |
| `sequence-invalid-arrow` | error | sequence dotted arrow syntax error |
| `comment-special-chars` | warning | `{` or `}` inside `%%` comments can confuse the parser |
| `mermaid-parse` | error | official Mermaid parser rejected the diagram |

## Notes

- Class diagrams use a headless DOM via `jsdom` because Mermaid's parser calls `DOMPurify` internally.
- Pre-parse rules (e.g. class brace balance) run before the official parser to avoid confusing runtime crashes on malformed input.
