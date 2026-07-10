# P1 validation contract

Every check records command, exit code, relevant counts, and failure output in `dev-log.md`. Focused checks run per wave; the reusable full gate runs at final integration.

## Global invariants

- No command under test writes outside its temporary artifacts/state/project roots unless the test explicitly verifies an allowed write.
- Long-running servers are started/stopped in herdr panes and leave no listener/state file.
- Tests never publish remotely or open a browser; `--no-open`, temporary env, and mocked publishers are mandatory.
- `artifacts/`, `app/out`, `cli/dist`, release output, and updater noise are never staged in P1 commits.

## Wave 0

```bash
node ai-artifacts/goals/p1-hardening/scan-artifacts.mjs
node --check ai-artifacts/goals/p1-hardening/scan-artifacts.mjs
git add -f ai-artifacts/goals/p1-hardening
git diff --cached --check
git diff --cached --name-status
git status --short
```

Evidence:
- 82 parseable saved specs; maxima recorded in `facts.md`.
- Planning files complete and internally consistent.
- Updater paths isolated by path-limited commit.

## Wave 1 — schema and resources

### Shared

```bash
cd shared
bun run typecheck
bun run build
```

### CLI focused

```bash
cd cli
bun test src/validate.test.ts src/commands/create.test.ts
bun run typecheck
bun run build
```

Required subprocess fixtures (`visual-artifact validate`):

| Fixture | Expected |
|---|---|
| unknown root property | exit 2; stderr path names unknown key |
| `metadata.id: 123` | exit 2; path `nodes[0].metadata.id` |
| invalid `gitStatus` scalar | exit 2; path `nodes[0].props.gitStatus` |
| empty `diff.props` | exit 2; path `nodes[0].props` |
| 31 top-level nodes | exit 2 |
| 21 datasets | exit 2 |
| 101 total nodes | exit 2 |
| node depth 9 | exit 2 without stack overflow |
| >500 file-tree items / depth 13 | exit 2 without stack overflow |
| 2 MiB + 1 byte file/stdin | exit 2 before full accumulation |

### App/contract

```bash
cd app
pnpm test
pnpm lint
pnpm export:contract
git diff --exit-code -- ../cli/assets/contract.json
pnpm verify:artifacts
pnpm build
```

Assertions:
- Local compatibility scan: all 82 parseable saved specs validate, including 67 total nodes/depth 5 and 16 datasets.
- Clean CI: tracked representative compatibility fixtures cover the largest supported structural shapes without committing runtime `artifacts/`.
- Schema node types = manifest keys = generated contract node types.
- Generated contract deep-equals `createArtifactContract()` and exports every selected limit.
- App loader rejects oversized raw text before JSON parse.
- No app/CLI executable semantic validator exists outside shared.

## Wave 2 — CLI contract

### Unit/type/build

```bash
cd cli
bun test
bun run typecheck
bun run build
```

### Real-process matrix

Run both `bun run src/main.ts` and `cli/dist/visual-artifact` where applicable.

| Case | stdout | stderr | exit |
|---|---|---|---:|
| `--help` | help | empty | 0 |
| `--version` | version only | empty | 0 |
| `--json --plain validate ...` | empty | conflict | 2 |
| invalid command/option | empty | Commander usage error | 2 |
| invalid JSON/schema/config | empty | actionable error | 2 |
| unexpected/runtime failure | empty | concise error | 1 |
| `--quiet create --no-serve` | primary human result | empty unless error | 0 |
| `--quiet --plain create` | URL only | empty unless error | 0 |
| `--quiet --json create` | one JSON document | empty unless error | 0 |
| `NO_COLOR=1`, `TERM=dumb`, non-TTY | no ANSI | as applicable | unchanged |
| `--verbose create` | primary result | paths/timing | 0 |
| unexpected `--verbose` error | empty | message + stack | 1 |

Representative output assertions:
- Every JSON result parses once, has `schemaVersion: 1` and `command`, and has no leading/trailing stdout noise.
- `create --json` retains `slug`, `projectName`, `projectPath`, `path`, `bundleDir`, `url`, `localUrl`.
- `open --json` is an object, not a bare URL.
- Plain records exactly match `decisions.md`.
- Human validate/list/doctor output contains no `[object Object]`/Bun inspection.

### Config side effects

For invalid port (`nope`, float, 0, 65536), host, mount/data path, base URL, boolean env, artifacts/out path:
- exit 2;
- no bind/listener;
- no spawned child/browser;
- no server state;
- no artifact/bundle write.

## Wave 3A Track A — source reads

Use temporary project, outside dir, symlink, artifacts dir, and fake publisher.

| Case | Expected |
|---|---|
| relative project file | inlined; persisted `src` stripped; source metadata count/bytes |
| `../` traversal | exit 2 even if target exists |
| project symlink → outside | exit 2 |
| absolute project path without grant | exit 2 |
| outside absolute without grant | exit 2 |
| outside path under repeated `--allow-read` | success |
| symlinked allow root/candidate | canonical containment only |
| 512 KiB file | success |
| 512 KiB + 1 | exit 2 |
| aggregate 1 MiB + 1 | exit 2 |
| final serialized >2 MiB | exit 2 |
| explicit content + forbidden src | succeeds without read |
| dry-run | same checks; no bundle/assets/publish/server |
| publish with sourced content | warning stderr; JSON `safety.diskSources.included=true` |
| Pi extension | invocation lacks `--allow-read`; fields still parse |

Commands:

```bash
cd cli
bun test src/commands/create.test.ts src/commands/create-source-safety.test.ts
bun run typecheck
bun run build
```

## Wave 3A Track B — repository gate

### Local entrypoint

```bash
./scripts/verify.sh
```

Must execute and pass:
- shared typecheck + build;
- CLI tests + typecheck + compiled native smoke;
- app tests + lint + export + contract diff + artifact verification + build + current-route health smoke;
- worker tests + typecheck.

### Workflow review

- YAML parses.
- Reusable verification workflow triggers on pull request and main, and accepts `workflow_call`.
- Matrix includes Linux x64 and macOS x64.
- Release/deploy have `needs: verify` via reusable workflow before upload/deploy.
- Node 22.22.3, Bun 1.1.34, pnpm 11.5.2 are aligned.
- App/shared/CLI/worker installs are frozen; CLI lockfile is committed.
- Deliberately alter generated contract in a test branch/worktree: gate fails at diff check.

## Wave 3B — annotations

### Local library/server

```bash
cd cli
bun test src/lib/annotations.test.ts src/commands/serve-annotations.test.ts src/commands/serve-lifecycle.test.ts
bun run typecheck
```

Required cases:
- annotation GET/mutation for missing artifact returns 404; no directory/file created;
- 20 concurrent unique create/add mutations all survive;
- temp file created in bundle, mode 0600, renamed atomically;
- injected write/rename failure leaves original valid and no temp residue;
- wrong mutation method 405 + Allow header;
- non-JSON content type 415;
- cross-origin/`cross-site` 403;
- exact same-origin succeeds;
- missing Origin/Fetch Metadata succeeds;
- loopback `localhost:9999` dev proxy to `localhost:9998` succeeds;
- non-loopback `serve` without opt-in exits 2 before bind/state/open;
- `--allow-remote` and strict env opt-in allow bind under controlled test.

### Client

```bash
cd app
pnpm test
```

Required cases:
- returned authoritative document replaces optimistic document;
- two rapidly invoked mutations post in order;
- first failure rolls back before second begins and does not clobber second success;
- `isSaving` stays true while queue has work and clears at drain.

### Worker

```bash
cd worker
bun test
bun run typecheck
```

Required cases:
- missing artifact annotation GET and mutation return 404 and create no annotation object;
- concurrent mutations conflict/retry and both survive;
- simultaneous first mutations use conditional create (`If-None-Match: *` equivalent) and both survive retry;
- conditional failure retries against latest etag;
- retry exhaustion returns 409;
- invalid method/content type/origin retain 405/415/403 behavior.

## Wave 4 — docs

```bash
git diff --check
# Run the repo's link/path check if one exists; otherwise verify changed relative links manually.
cd app
pnpm export:contract
git diff --exit-code -- ../cli/assets/contract.json
cd ../cli
bun run src/main.ts --help
bun run src/main.ts create --help
bun run src/main.ts serve --help
```

Manual consistency matrix:
- CLI docs/help/output tests agree on every global flag and plain record.
- Resource and read-authority text agrees across README, skill, Pi extension, contract, architecture, and node docs.
- Annotation docs distinguish local atomic queue and hosted conditional retry.
- Reliability/release docs name `./scripts/verify.sh` and exact runtime pins.

## Wave 5 — final clean-tree gate

Precondition:

```bash
git status --short  # empty
```

Run in herdr:

```bash
./scripts/verify.sh
```

Then compiled CLI smoke with temporary roots:

```text
help/version → validate/create human → JSON → plain → quiet → invalid config
contained src → denied traversal/symlink/absolute → explicitly allowed src → byte denial
serve --no-open → status → artifact/annotation GET → secure mutation → concurrent mutations → stop
```

Final inspection:

```bash
git status --short
git log --oneline --decorate <wave-0-base>..HEAD
git diff --check <wave-0-base>..HEAD
git diff --name-status <wave-0-base>..HEAD
```

Use `sem_diff` for entity-level summary and raw diff for generated/workflow/docs coverage.

Final evidence must state:
- exact pass/fail counts and commands;
- commit list by wave;
- reviewer blockers/fixes/deferred/rejected feedback;
- no tracked runtime artifacts/updater leakage;
- residual risks and P2 deferrals.
