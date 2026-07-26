# Code reviews

Use this route for `/visual-diff` and review artifacts built from changed source.

## Review flow

1. Resolve the requested git scope and inspect the diff.
2. Read changed implementations plus relevant callers, entrypoints, dependencies, and tests.
3. Lead with the review conclusion, risks, and affected behavior.
4. Use diff/table/status nodes for changed evidence.
5. Add `execution-trace` when the change has a meaningful behavior path that helps a reviewer understand control flow, boundaries, or typed transformations.
6. Create the artifact and return its URL.

Do not add an execution trace merely to decorate a review. Omit it for copy-only, style-only, generated-file, or isolated constant changes with no meaningful path.

## Static execution traces

Static analysis is the default. Reading source is enough; do not execute the program merely to populate the trace.

Derive the path by following:

- entrypoints and relevant callers
- imports, registry lookups, and function calls
- parameters, return values, and static types
- validation, parsing, file, process, network, and output boundaries
- branches and failure paths that materially affect the review
- tests and fixtures that document expected behavior

Prefer 4–12 meaningful frames. Model the semantic path, not every helper call. Start at the closest relevant entrypoint and end at the user-visible output or side effect.

## Evidence rules

For source-only traces:

- trace provenance: `mode: "inferred"`, `method: "static-analysis"`
- source-established control flow: `evidence.origin: "inferred"` or `"derived"`
- unknown runtime values: symbolic previews with `runtimeType: "unknown"`, or omit `runtimeType`
- literals, tests, and fixtures: concrete examples may be `derived`, with the source file named in `evidence.note`
- never label a value `captured` unless code actually ran and produced it
- never invent timings, branch outcomes, network responses, or exceptions
- lower confidence when dynamic dispatch, reflection, generated code, or missing dependencies prevent a unique path

Keep static and runtime types separate. A symbolic value should describe the transformation, for example:

```text
record.used_percent: unknown
→ toNumber(...)
→ usedPercent: number
→ clampPercent(...)
→ number in [0, 100]
```

Use `event.code.src` with a project-relative path and pair it with `codeRef` so create-time source inlining can show the active line. Set `initialEventId` to the frame most relevant to the review.

## Presentation

- One persistent call stack; previous/next moves the current frame.
- Boundary events deserve priority over generic calls.
- Keep values concise enough to scan beside source.
- Put alternate or uncertain paths in separate traces only when they matter.
- State plainly when the trace is inferred rather than runtime-captured.
