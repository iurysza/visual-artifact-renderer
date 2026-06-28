---
description: "Collect factual codebase evidence before making an architecture artifact."
date created: 2026-06-16T20:50:00
date modified: 2026-06-28T00:00:00
tags: ["visual-artifact", "architecture", "extraction"]
---

# Deterministic fact collection

Build a fact base before interpretation. Do not start with opinions.

## Collect

- package manager, frameworks, scripts, dependencies
- top-level folder structure and entry points
- routes/pages/API surfaces
- important config files
- internal import/dependency direction
- test/lint/build commands
- public interfaces and integration points
- recent git churn if relevant

## Useful commands

```bash
fd -t f . <repoRoot>
rg "TODO|FIXME|export |class |function " <repoRoot>
git -C <repoRoot> log -n 20 --pretty=format:'%h %s'
git -C <repoRoot> status --short
```

Use language-aware search (`ast-grep`) when matching code structure matters.

## Suggested notes

Write concise notes to:

```text
<repoRoot>/ai-artifacts/generated/<slug>/facts.md
```

Include:

- purpose
- stack
- entry points
- module/layer map
- data/runtime flows
- unresolved questions

## Next step

Move to [architecture analysis](./agentic-workflows.md).
