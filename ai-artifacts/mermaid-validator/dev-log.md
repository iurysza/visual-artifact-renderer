# Dev Log — Mermaid Validator

## What was built

A validation system that catches bad Mermaid syntax before it goes into artifacts.

- `src/lib/mermaid-validator.ts` — core validator (pre-parse rules + official parser)
- `scripts/validate-mermaid.ts` — CLI for files and inline strings
- `scripts/test-mermaid-validator.ts` — demo test cases

## Bug found on first real run

Ran the validator on `~/.pi/artifacts/visualizer/visualizer-serving-architecture.json`.

**Error:**

```
Lexical error on line 13. Unrecognized text.
...t;/&lt;slug&gt;.json]  JsonEndpoint -->
-----------------------^
```

**Root cause:** The `JsonEndpoint` node used a parallelogram shape (`[/`) but closed it with `]` instead of `/]`.

```
# BROKEN
JsonEndpoint[/artifacts/data/artifacts/&lt;project&gt;/&lt;slug&gt;.json]

# FIXED
JsonEndpoint[/artifacts/data/artifacts/&lt;project&gt;/&lt;slug&gt;.json/]
```

This is a classic Mermaid syntax mistake — the parallelogram requires matching `/]` at the end. The parser treats the unclosed `/[` as an invalid construct and the trailing `]` becomes unrecognized text.

**Fix applied:** Updated `~/.pi/artifacts/visualizer/visualizer-serving-architecture.json` with the corrected closing `/]`.

## Validator output on the fixed diagram

```json
{
  "valid": true,
  "diagramType": "flowchart-v2",
  "errors": [],
  "warnings": []
}
```

## How to reproduce

```bash
# Validate the artifact
pnpm validate:mermaid ~/.pi/artifacts/visualizer/visualizer-serving-architecture.json --json

# Or test the specific broken line
pnpm validate:mermaid --inline "flowchart LR\n  JsonEndpoint[/foo.json]" --json
# → error: unrecognized text

pnpm validate:mermaid --inline "flowchart LR\n  JsonEndpoint[/foo.json/]" --json
# → valid
```

## Why this matters

Without the validator, the broken diagram would fail silently in the browser renderer (no visible diagram, no clear error). The validator gives line-level feedback so the LLM can auto-correct before the artifact is saved.
