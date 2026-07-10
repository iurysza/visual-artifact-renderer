# P1 hardening dev log

## Status

- Current wave: 3A — file-read boundary and verification gate.
- Implementation: Waves 0–2 complete; Wave 3A next.
- Baseline branch: `main`.
- Parent session handoff: `2026-07-10T07-42-31-695Z_019f4afa-650f-7d38-8bd4-aa79a3de7ed7.jsonl`.

## Wave 0 — facts and plan

### Evidence gathered

- Read user/repo instructions, recurring rules, relevant architecture/product/reliability/CLI/frontend/annotation/publishing/release/node docs.
- Read `create-cli`, `pi-subagents`, `ask-user`, `commit`, `visual-artifact`, and ADR skills.
- Parent inspected shared schema/manifest, app schema/export/verifier/loaders, CLI validator/config/logger/all core commands, file source expansion, annotation server/storage/client, Worker routes/tests, package scripts, health check, and release/deploy workflows.
- Prior session query recovered exact updater output and audit evidence.
- Saved-artifact scan: 82 specs; 36,578 B raw; 16 datasets; 29 top-level/67 total nodes; depth 5; 51 file-tree items/depth 4; largest string 6,527 B.
- Official Cloudflare evidence: R2 conditional `put` supports `onlyIf`, failed conditions return `null`, and object operations are strongly consistent.

### Decisions

- Shared executable Zod schema is authoritative; manifest signatures are documentation.
- Resource envelope selected with observed headroom; no existing artifact migration required.
- CLI JSON/plain/human/config/exit contracts fixed in `decisions.md`.
- Outside file reads use repeatable explicit `--allow-read`; Pi remains project-contained.
- Local annotations use keyed queue + atomic writes; remote bind requires opt-in; Worker uses conditional retry.
- Verification uses one reusable entrypoint/workflow with exact runtime pins.
- Updater outputs are intentional for both detected provider roots and hook integration; isolate rather than discard.

### Subagent wave

- Context run: `58f15778-bfa7-43c1-8ad6-16725de80d2f`.
- Four fresh read-only context builders: schema/resources; CLI UX/config; security/annotations; CI/release. Three completed; the CLI builder was interrupted after excessive output, and its reproduced output was independently checked.
- Plan review run: `2de10379-ce6a-4cbb-8181-7fa1d5400c8d` with two fresh adversarial reviewers.
- Parent independently verified accepted claims and cleaned the CLI builder's temporary `127.0.0.1-NaN.json` state.

### Files

- `ai-artifacts/goals/p1-hardening/goal.md`
- `ai-artifacts/goals/p1-hardening/facts.md`
- `ai-artifacts/goals/p1-hardening/decisions.md`
- `ai-artifacts/goals/p1-hardening/plan.md`
- `ai-artifacts/goals/p1-hardening/validation.md`
- `ai-artifacts/goals/p1-hardening/dev-log.md`
- `ai-artifacts/goals/p1-hardening/scan-artifacts.mjs`

### Validation

- `node ai-artifacts/goals/p1-hardening/scan-artifacts.mjs` — pass; 82 specs and maxima above.
- `jq '.nodes | length' ...visualizer-maintainability-refactor-v3...` — 29 top-level nodes; confirms scanner over a scout's lower, incorrect count.
- `node --check ai-artifacts/goals/p1-hardening/scan-artifacts.mjs` — pass.
- `git diff --cached --check` after force-adding the ignored goal package — pass.
- Explicit all-file app test discovery — 45 pass / 2 provider DOM failures; bare default discovery's 46-pass result omits `.test.tsx`.
- Updater executable syntax checks and provider manifests — pass.
- No listener, NaN lifecycle state, `.sem` cache, or Wave 0 temp roots remain.

### Commits

- `08de19f` — `docs(p1): define hardening contract`; seven goal-package files only.
- `607697c` — `chore(skills): update impeccable`; updater-owned `.agents`, `.pi`, and `.codex` paths only.
- Wave 0 evidence log: this follow-up documentation commit.

### Remaining risks

- Full Node+tsx app suite currently has 45 pass / 2 AI Colab provider DOM failures; Wave 3A must fix, not exclude, them before adding `pnpm test`.
- Confirm exact R2 conditional object fields against installed Worker types during Wave 3B.
- Confirm `.pi` provider variant differences are updater-intended during housekeeping diff review.

## Wave 0 review synthesis

### Blockers — fixed in docs

- Goal packages are ignored: documented explicit `git add -f`, cached diff inspection, and staged validation.
- Local 82-artifact scan is not clean-CI reproducible: retained as local compatibility evidence and added tracked representative fixture requirements.
- Worker contract omitted annotation GET existence, browser write policy, and first-write CAS: added all three.

### Fix now — accepted

- JSON source diagnostics now use project/allow-root-relative display paths; canonical absolute paths are verbose-stderr only.
- Added concrete `create-source-safety.test.ts` path.
- Clarified top-level node cap has one-node margin, not broad headroom.
- Clarified release-published gate protects asset upload/deploy, while PR/main protects normal release creation; manual deploy needs ref fallback.
- New persisted artifacts strip create-time `src`; historical saved specs remain accepted.
- Track generated contract JSON and CLI lockfile so clean CI can enforce reproducibility.

### Optional/deferred

- Worker rate limiting/auth, SBOM/provenance, installer checksums: P2 unless correctness implementation proves directly required.
- Separate root `plan.md`/`progress.md`: not requested; repo explicitly requires the goal package path.

### Rejected feedback

- “Missing artifacts handled safely”: false for annotation GET/write; current local and Worker synthesize annotations without `artifact.json`.
- Scout's proposed 128 KiB/256-node envelope: rejected in favor of the documented measured envelope and user-mandated advertised limits.
- “App passes 46/46, remove failure task”: false green; default Node discovery skips `.test.tsx`. Explicit six-file run reproduces two failures, which the CI wave will fix rather than exclude.

### Commit

- Planning and housekeeping hashes recorded above.

## Wave 1 — shared executable schema and resource limits

### Shipped

- Moved executable artifact validation to `shared/`; app now re-exports it and CLI removed the handwritten manifest interpreter.
- Added iterative preflight plus the selected 2 MiB/node/dataset/depth/file-tree envelope before recursive Zod parsing.
- Added bounded browser, Node, Bun file/stdin reads; regular-file/FIFO protection; final serialized create-size validation.
- Restored Mermaid parity for `validate`, bracketed CLI paths, tracked generated contract output, strict button URL schemes, parity/resource fixtures, and 82-spec recursive verification.

### Validation

- Shared typecheck/build — pass.
- CLI focused gate — 62 pass; full suite — 156 pass; typecheck/build/compiled smoke — pass.
- App focused loader/schema/read gate — 11 pass; lint/export/82-spec verify/build — pass.
- Generated contract has no unstaged drift; cached diff check and runtime-artifact status — clean.

### Review synthesis

- Three fresh initial reviewers found app preflight bypass, top-level-only/non-aggregate file-tree checks, Mermaid regression, unbounded reads, weak fixtures, and path formatting; all fixed.
- Two fresh Gemini re-reviewers found no remaining Wave 1 correctness issue. Their source containment/per-source findings are the already-planned Wave 3A boundary, not Wave 1 regressions; existing Mermaid normalization/security-level observations are deferred outside this schema wave.
- Codex re-review attempts hit provider usage limits; Gemini fresh-context fallback completed.

### Commit

- `02f528a` — `fix(contract): unify artifact validation`.

## Wave 2 — CLI output and configuration contract

### Shipped

- Centralized human/JSON/plain primary output in `Logger.result`; JSON uses `schemaVersion: 1`, plain records match D3, and `--quiet` never suppresses stdout results.
- Routed diagnostics/progress to stderr, added TTY/`NO_COLOR`/`TERM=dumb` color rules, verbose timing and unexpected-error stacks, and isolated bootstrap child output from structured stdout.
- Added one strict config boundary for ports, hosts, URL paths, filesystem paths, base URLs, booleans, project paths, contract paths, and explicit remote exposure; CLI overrides now preserve CLI > env > default precedence and validate before side effects.
- Added Commander-level JSON/plain conflicts and exit 0/1/2 mapping, stable source/compiled subprocess coverage, Pi create-field compatibility, IPv6 URL normalization, human contract summary, explicit legacy full-contract JSON, and documented remote serve opt-in in help.

### Validation

- Parent full gate in herdr: `cd cli && bun test && bun run typecheck && bun run build` — 262 pass / 0 fail; typecheck pass; compiled build/smoke pass.
- Parent source+binary matrix: help/version, serve help, conflict, validate/create human+JSON+plain+quiet+verbose, invalid config, default/explicit/versioned contract modes — pass.
- Focused source+binary suite after initial fixes — 105 pass / 0 fail.
- `git diff --cached --check` and path inspection — pass; 22 CLI source/test files only.
- Saved compatibility gate — 82/82 specs validate. With explicit user approval, removed only the invalid root `projectPath` from ignored `artifacts/var/serve-stop-v040-feature-guide/artifact.json`; both protected artifact directories remain, and no runtime artifact was staged or committed.

### Review synthesis

- Three fresh reviewers found: blank CLI path overrides bypassed validation, strict booleans accepted surrounding whitespace, default contract output bypassed the human result mode, summary+JSON compatibility needed preservation, and `serve --help` omitted remote exposure. All accepted findings were fixed.
- Two fresh re-reviewers found no remaining blockers and independently reran 262/262 tests, typecheck, build, compiled smoke, and diff checks.
- Deferred one low-risk non-dry-run bootstrap stream integration test because it would rebuild/install into the user's home. The child-output path is structurally reviewed; dry-run/output formatting and final bootstrap verification remain covered separately.
- Annotation request policy is intentionally still pending Wave 3B; the early remote-bind gate is not counted as annotation completion.

### Commit

- `7285d06` — `fix(cli): enforce stable output and config`.
