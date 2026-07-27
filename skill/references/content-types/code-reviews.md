# Code reviews

Use this route for `/visual-diff`, code-change plans, and review artifacts built from changed source. `execution-trace` is especially useful when the main question is the shape of the API surface: interfaces, types, and boundaries.

## Review flow

1. Resolve the requested git scope and inspect the diff.
2. Read changed implementations plus relevant callers, entrypoints, dependencies, and tests.
3. Lead with the review conclusion, risks, and affected behavior.
4. Use diff/table/status nodes for changed evidence.
5. Add `execution-trace` when the change has a meaningful behavior path, or when a plan/review mainly needs to expose interfaces, types, and boundaries.
6. Select the ordered source spans and run `visual-artifact --json trace inspect --project <root> --anchor <file:start[-end]> ...`.
7. Copy each resolved `.sources[].source` object into its event unchanged, add narrative fields, then create the artifact and return its URL.

Do not add an execution trace merely to decorate a review. Omit it for copy-only, style-only, generated-file, or isolated constant changes with no meaningful path or API surface.

## API-surface plans and reviews

Make `execution-trace` the primary view when a code-change plan or review mostly asks:

- which interfaces and types enter or leave a boundary
- where validation, parsing, persistence, process, network, registry, or rendering ownership changes
- how one contract becomes another
- which errors or observable effects belong to each boundary

Prioritize boundary events and `typeDefinitions` over a long call transcript. Use inputs and outputs to show contract shape, and pair the trace with a diff or comparison when before/after API shape matters. Source-backed frames may describe only code that exists: keep proposed target APIs in clearly labeled narrative or comparison content, never fabricated source facts.

## Static execution traces

Static analysis is the default. Reading source is enough; do not execute the program merely to populate the trace.

Derive the path by following:

- entrypoints and relevant callers
- imports, registry lookups, and function calls
- parameters, return values, and static types
- validation, parsing, file, process, network, and output boundaries
- branches and failure paths that materially affect the review
- explicit observable effects such as I/O, state mutation, scheduling, or external calls
- tests and fixtures that document expected behavior

Prefer 4–12 meaningful frames. Model the semantic path, not every helper call. Start at the closest relevant reviewed call and end at the user-visible output or side effect. Do not label the first frame an application entrypoint unless source proves that role; `initialEventId` only chooses the initial review focus.

## Evidence rules

For source-only traces:

- trace provenance: `mode: "inferred"`, `method: "static-analysis"`
- source-established control flow: `evidence.origin: "inferred"` or `"derived"`
- unknown runtime values: symbolic previews with `runtimeType: "unknown"`, or omit `runtimeType`
- literals, tests, and fixtures: concrete examples may be `derived`, with the source file named in `evidence.note`
- never label a value `captured` unless code actually ran and produced it
- never invent timings, branch outcomes, network responses, or exceptions
- add `event.impacts` only for source-established effects or possible errors; keep each to `kind`, `title`, optional description, and optional exact `codeRef`
- do not infer propagation graphs, direct/transitive classifications, confidence labels, or runtime outcomes for impacts
- omit impacts when the evidence is ambiguous
- lower confidence when dynamic dispatch, reflection, generated code, or missing dependencies prevent a unique path

Keep static and runtime types separate. A symbolic value should describe the transformation, for example:

```text
record.used_percent: unknown
→ toNumber(...)
→ usedPercent: number
→ clampPercent(...)
→ number in [0, 100]
```

Source identity is extractor-owned. Give `trace inspect` one ordered project-relative line or line range per event. A resolved source object carries the exact span, excerpt, hash, syntax kind, focused expression/symbol, and enclosing scope. Copy it unchanged. If inspection returns `ambiguous`, choose a narrower span; never pick a candidate by prose. `visual-artifact create` re-extracts every span and rejects stale or edited facts. Set `initialEventId` to the step most relevant to the review.

Add top-level `typeDefinitions` for important custom names referenced by `staticType`—domain objects, aliases, unions, and boundary contracts. Include the exact declaration, source file and line, language, and `derived` provenance when copied from source. Omit primitives and types whose declarations are unavailable; never invent a definition.

## Presentation

- One persistent call stack; previous/next moves the current step. The event order is agent-selected, while every displayed code identity is source-verified.
- Boundary events deserve priority over generic calls. Boundary `from`/`to` remain conceptual; never add a freeform code operation.
- Keep values concise enough to scan beside source.
- Put alternate or uncertain paths in separate traces only when they matter.
- State plainly when the trace is inferred rather than runtime-captured.
