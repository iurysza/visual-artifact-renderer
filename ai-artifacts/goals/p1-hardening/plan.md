# P1 hardening implementation plan

## Operating rules

1. Parent inspects relevant source and every diff; subagents supply evidence/implementation, not final judgment.
2. One writer per active worktree. Parallel writers require disjoint files and isolated git worktrees.
3. After each implementation wave: parent diff review → 2–4 fresh-context reviews → synthesis → one fix writer → re-review if substantial → focused validation → commit.
4. Commit only the wave's files. Never stage `artifacts/`, updater noise, build output, secrets, or OpenSpec changes.
5. Long checks run in herdr (`HERDR_ENV=1`).
6. After each implementation commit, append commit/test/review evidence to `dev-log.md` in a small documentation commit or the immediately following documentation commit.
7. Stop and use `ask_user` only for a materially new choice not settled in `decisions.md`.

## Wave 0 — facts, decisions, validation, tree isolation

### Read-only fanout

- Schema/contract/resource builder.
- CLI UX/config builder.
- File-read/annotation/Worker security builder.
- CI/release builder.

### Parent work

- Independently inspect all load-bearing files and reproduce critical behavior.
- Scan saved artifacts with `scan-artifacts.mjs`.
- Write this complete goal package before product implementation.
- Review updater output and repo conventions.

### Commits

`ai-artifacts/goals/` is intentionally ignored for normal local goal packages. This user explicitly requires the P1 package committed, so stage this package only with `git add -f ai-artifacts/goals/p1-hardening` and inspect the cached diff.

1. `docs(p1): define hardening contract`
   - Only `ai-artifacts/goals/p1-hardening/`.
2. `chore(skills): update impeccable`
   - Only updater-owned `.agents/skills/impeccable/`, `.pi/skills/impeccable/`, `.codex/`.

### Gate

- Goal/facts/decisions/plan/validation/dev-log exist and agree.
- `git diff --check` on planning/updater files.
- Tree clean after both commits.

## Wave 1 — shared executable schema and resource limits

### Writer contract

- Move schema/helpers/types into a shared runtime export.
- Add iterative preflight before recursive Zod parsing; add size-aware raw parser.
- Preserve app imports through re-export and update loaders to parse bounded text.
- Replace CLI semantic validator with shared parse + humanized Zod issues.
- Add parity fixtures, four audit regressions, resource fixtures, tracked representative compatibility specs outside runtime `artifacts/`, local validation of all 82 saved specs, and contract deep-sync checks.
- Stop ignoring, regenerate, and track `cli/assets/contract.json` so CI can detect export drift.

### Likely files

- `shared/src/artifact-schema.ts`, `shared/src/contract.ts`, `shared/package.json`.
- `shared/fixtures/*`.
- `app/src/lib/contract/artifact-schema.ts`, `schema-helpers.ts`, client loader(s), contract verifier/tests.
- `cli/src/validate.ts`, `types.ts`, validate/create tests.
- `cli/assets/contract.json`.

### Reviews (fresh context)

1. Contract parity/schema correctness/resource-preflight safety.
2. Existing artifact compatibility and test coverage.
3. Simplicity/package boundaries/no duplicate executable validator.

### Focused gate

- Four known invalid subprocess fixtures exit 2 with paths.
- All 82 local parseable saved specs pass shared schema; tracked representative compatibility fixtures pass in clean CI.
- Shared typecheck/build; CLI tests/typecheck/build; focused app schema tests plus lint/export/diff/verify/build. The complete `pnpm test` script lands in Wave 3A.

### Commit

`fix(contract): unify artifact validation`

## Wave 2 — CLI output and configuration contract

### Advisory fanout

- Human/script CLI UX review against `create-cli`.
- Subprocess-test/config side-effect design.

### Single writer contract

- Build one output-mode/result abstraction and real verbose diagnostics.
- Add parse-time output-mode conflict and Commander exit mapping.
- Add strict Zod config parser and validated CLI/env overrides.
- Refactor all command outputs enough that no human object inspection/minified-JSON plain output remains.
- Preserve Pi create JSON fields; add `schemaVersion`/`command`.
- Add real-process tests for help/version, conflict, invalid config, quiet, colors, stderr, outputs, and exits.

### Likely files

- `cli/src/main.ts`, `config.ts`, `logger.ts`, `types.ts`, `env.ts`, `util.ts`.
- Most `cli/src/commands/*.ts` and new subprocess fixtures/tests.
- `pi-extension/visual-artifact.ts` only if additive parsing/types need coordination.

### Reviews (fresh context)

1. Human/script UX and documented plain records.
2. Config/exit/stdout-stderr correctness and no-side-effect invalid input.
3. Pi/backward compatibility and regression tests.

### Focused gate

- CLI unit + subprocess suite, typecheck, compiled smoke.
- Manual human/JSON/plain/quiet/verbose/conflict/invalid-port matrix.
- Invalid config leaves no server, browser, artifact, or lifecycle state.

### Commit

`fix(cli): enforce stable output and config`

## Wave 3A — parallel disjoint tracks: file reads and verification gate

Start only from a clean tree. Use isolated worktrees.

### Track A writer — file-tree read boundary

Files: `cli/src/commands/create.ts`, `cli/src/main.ts`, targeted CLI tests/docs-local help only.

- Implement canonical project/allow-root checks and repeatable `--allow-read`.
- Enforce per-file/aggregate/final bytes.
- Emit JSON/verbose source metadata and publish warning.
- Keep Pi contained by default.

Commit: `fix(cli): contain file-tree source reads`

### Track B writer — CI/release gate

Disjoint files: `scripts/verify.sh`, root/app/shared/cli/worker package/lock metadata as needed, app health script, `.github/workflows/*`, release script.

- Fix the two currently failing AI Colab provider DOM tests/behavior, add the app test script, and repair current-route health smoke.
- Add frozen installs/pins (Node 22.22.3, Bun 1.1.34, pnpm 11.5.2), reusable verify workflow, release/deploy dependencies, contract diff gate, dual-OS native smoke.

Commit: `ci: gate pull requests and releases`

### Integration

- Parent reviews both commits, cherry-picks Track A then Track B, resolves only evidence-backed integration issues.
- Run combined CLI + verification focused checks.
- Fresh reviews: file capability security; CLI regression/Pi compatibility; CI reproducibility.
- One integration writer applies accepted findings. Substantial fixes get another focused review.

### Integration-fix commit (only if needed)

`fix(p1): resolve security gate integration`

## Wave 3B — annotation integrity and local/hosted security

Sequential after 3A because it overlaps CLI `main.ts`/config/server behavior.

### Single writer contract

- Require artifact existence for annotation reads/mutations.
- Add per-artifact queue and atomic mode-0600 writes with cleanup.
- Add method/content-type/origin/Fetch Metadata policy on both local and Worker mutation routes.
- Add explicit remote exposure flag/env.
- Serialize client optimistic mutations and accept authoritative documents.
- Add Worker artifact checks for annotation reads/writes and conditional R2 retry, including `If-None-Match: *`-equivalent first-write races.
- Add local/client/Worker concurrency/security tests.

### Likely files

- `cli/src/main.ts`, `config.ts`, `commands/serve.ts`, `lib/annotations.ts`, related tests.
- `app/src/components/annotations/annotation-provider.tsx`, app annotation client/provider tests.
- `worker/src/routes.ts`, Worker mock/tests; possibly shared request-policy helper only if reuse is simpler than duplication.

### Reviews (fresh context)

1. Local filesystem atomicity/concurrency/cleanup.
2. Browser origin/exposure security and dev-proxy compatibility.
3. Client ordering and authoritative reconciliation.
4. Worker R2 conflict correctness/retry behavior.

### Focused gate

- Concurrent local and Worker mutation tests.
- 404/405/415/403 and dev-proxy/missing-Origin tests.
- Remote bind subprocess test.
- Client queue/reconciliation DOM tests.
- CLI/app/worker typechecks and focused suites.

### Commit

`fix(annotations): serialize secure writes`

## Wave 4 — cross-surface docs and contract wording

### Single writer contract

Update behavior, not aspiration:

- `README.md`, `skill/SKILL.md`, `ai-artifacts/docs/cli.md`, `RELIABILITY.md`, `ARCHITECTURE.md`, `SEMANTIC_MAP.md`, `FRONTEND.md`, `annotations.md`, `publishing.md`, `RELEASE.md`, `nodes.md` as relevant.
- Pi tool descriptions and CLI help examples.
- Remove stale URL-only/plain ambiguity, absolute-read permission claim, duplicate-validator tradeoff, optimistic rollback claim, unenforced limits, stale health route, and version drift.
- Generated contract reflects shipped limits.

### Reviews (fresh context)

1. Docs/API/help/JSON/plain consistency.
2. Security claims vs local and Worker behavior.
3. Scope creep/stale paths/examples.

### Gate

- Docs path/link sanity, `git diff --check`, contract export/diff.
- Representative help output compared with docs.

### Commit

`docs(p1): document hardened boundaries`

## Wave 5 — final integration, evidence, visual review

1. Ensure implementation/docs tree clean.
2. Run `./scripts/verify.sh` in herdr from clean tree.
3. Run compiled/installed CLI smoke matrix:
   - help/version/conflict;
   - create/validate human+JSON+plain+quiet+invalid;
   - contained/allowed/oversized file-tree reads;
   - serve/status/annotation/stop;
   - local annotation security and concurrent writes.
4. Inspect `sem_diff`, raw `git diff`/history, and per-commit file lists.
5. Confirm updater files appear only in housekeeping commit and no runtime artifacts are tracked.
6. Update `dev-log.md` with final evidence and residual risks; commit documentation.
7. Read final visual-artifact references, run `visual-artifact contract`, and create the requested review artifact without committing runtime output.

### Final reviewers

- Security/trust boundaries.
- Correctness/concurrency/regressions.
- CLI/CI/release reproducibility and docs consistency.

Accepted final fixes use one writer and trigger focused re-review if substantial.

### Commit

`docs(p1): record final verification`

## Risks and controls

| Risk | Control |
|---|---|
| Shared schema move breaks app imports | Compatibility re-export; app typecheck/build and saved-spec parse. |
| Recursive input exhausts parser before refinement | Iterative preflight schema stage and bounded raw reader. |
| Output refactor breaks Pi | Preserve top-level fields; extension subprocess test. |
| Config validation changes obscure command behavior | Subprocess no-side-effect tests and explicit exit 2. |
| Canonical read checks mishandle symlinks/nonexistent roots | `realpath` roots/candidates; dedicated traversal/symlink tests. |
| Atomic write leaves temp files | Same-directory unique temp and `finally` cleanup test. |
| Origin policy breaks Next dev proxy | Loopback proxy exception + Fetch Metadata tests/manual smoke. |
| Client serialization harms responsiveness | Optimistic state is applied when each queued transaction starts; saving state remains visible. |
| R2 retry assumptions are wrong | Official `onlyIf` semantics; conflict-aware fake R2 tests; bounded 409. |
| Reusable workflow recursion/permissions | `workflow_call` job dependency, minimal permissions, syntax review. |
| Parallel track merge conflict | Track A and B file ownership is disjoint; annotation work waits until integration. |
| Runtime/artifact/updater noise leaks into commits | Path-limited staging and per-commit inspection. |

## Unresolved questions

None.
