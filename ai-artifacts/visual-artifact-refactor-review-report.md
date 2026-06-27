# Visual Artifact Refactor Review Report

Date: 2026-06-27
Scope: Visualizer refactor only (`skill/**`, `pi-extension/visual-artifact.ts`, `README.md`). Impeccable findings ignored.

Verdict: **block ship** until P1s are fixed.

## Summary

| ID | Priority | Status | Finding |
|---|---:|---|---|
| VA-1 | P1 | Verified real | `create_visual_artifact` / piped stdin cannot create artifacts |
| VA-2 | P1 | Verified real | `create --json` stdout is polluted; `--no-serve` is ignored |
| VA-3 | P1 | Verified real | clean-source `bootstrap` fails on ignored generated contract import |
| VA-4 | P2 | Verified real, conditional | copied-binary install fallback is not self-contained and falls back to legacy dirs |
| VA-5 | P2 | Verified real | README/docs drift from new CLI and artifact paths; base URL env ignored |

## VA-1 — P1 — stdin create path fails

Status: **verified real**.

Files/lines:
- `pi-extension/visual-artifact.ts:23-24` calls `visual-artifact create --project <path> --json` and passes JSON via `spawnSync(..., { input })`.
- `pi-extension/visual-artifact.ts:35` parses `result.stdout` as JSON.
- `skill/cli/src/util.ts:29` reads stdin only when `inputPath === "-"` or `process.stdin.isTTY === false`.

Why it matters:
- The Pi extension's `create_visual_artifact` tool sends JSON through stdin without `-`, so the CLI exits before validation/write.
- The documented `cat my-spec.json | visual-artifact create` path is also suspect for Bun because `process.stdin.isTTY` is `undefined`, not strict `false`.

Repro:

```text
node spawnSync('visual-artifact', ['create', '--project', cwd, '--json'], { input: specJson })
status=2
stdout=""
stderr="error: No input provided. Pass a file path or pipe JSON to stdin.\n"
```

## VA-2 — P1 — `create --json` polluted and `--no-serve` ignored

Status: **verified real**.

Files/lines:
- `skill/cli/src/main.ts:40` registers `--no-serve`.
- `skill/cli/src/commands/create.ts:15` expects `noServe?: boolean`.
- `skill/cli/src/commands/create.ts:108-109` checks `if (!opts.noServe) await ensureServer(log)`.
- `skill/cli/src/commands/create.ts:46,52,63` logs renderer status with `log.log(...)`.
- `skill/cli/src/logger.ts:19` writes `log.log` to stdout.

Why it matters:
- Commander stores `--no-serve` as `opts.serve === false`, not `opts.noServe`, so the server starts even when the user requests no serve.
- In JSON/plain modes, human server logs appear on stdout before machine output. Any caller doing `JSON.parse(stdout)` breaks.

Repro:

```text
VISUAL_ARTIFACT_PORT=19401 \
VISUAL_ARTIFACT_ARTIFACTS_DIR=/tmp/va-verify-noserve-artifacts \
VISUAL_ARTIFACT_OUT_DIR=/tmp/va-missing-out \
visual-artifact --json create /tmp/spec.json --no-serve

status=0
stdout begins:
Starting renderer in the background: ... visual-artifact serve --no-open
{
  "ok": true,
  ...
}
stderr:
warn: Renderer did not become ready at http://127.0.0.1:19401/artifacts within 3 seconds
```

## VA-3 — P1 — clean-source bootstrap fails before it can bootstrap

Status: **verified real**.

Files/lines:
- `skill/cli/src/contract.ts:6` statically imports `./assets/contract.json`.
- `skill/cli/.gitignore:7` ignores `/src/assets/contract.json`.
- `skill/cli/scripts/build.ts:36-37` creates that file only during build.

Why it matters:
- `bun run src/main.ts bootstrap --dry-run` imports all command modules, including `contract.ts`, before running bootstrap.
- On a clean checkout, the generated contract asset is absent, so bootstrap cannot start.
- This contradicts `skill/SKILL.md:79-86`, which documents bootstrapping directly from the skill directory.

Repro in clean worktree after `bun install`:

```text
status=1
error: Cannot find module './assets/contract.json' from '/private/tmp/visualizer-review-clean/skill/cli/src/contract.ts'
```

## VA-4 — P2 — copied-binary install fallback is not self-contained

Status: **verified real, conditional**.

Files/lines:
- `skill/cli/scripts/install.ts:46` tries symlink.
- `skill/cli/scripts/install.ts:48` falls back to copying only the binary.
- `skill/cli/src/config.ts:45-48` falls back to `~/.pi/tools/visual-artifact/out` when `findSkillRoot()` fails.
- `skill/cli/src/config.ts:66` uses that fallback as `outDir`.

Why it matters:
- If symlink creation fails, the copied binary cannot discover the skill root.
- It then serves legacy fallback dirs (`~/.pi/tools/visual-artifact/out`, `~/.pi/artifacts`) instead of the new self-contained `skill/app/out` and `skill/artifacts`.
- On this Mac the legacy out dir exists, so it starts, but that proves the fallback is using old global state, not the refactored skill-owned state. On a clean machine it can fail outright.

Observed copied-binary behavior:

```text
Visualizer server running at http://127.0.0.1:19402/artifacts
  outDir:      /Users/iurysouza/.pi/tools/visual-artifact/out
  artifacts:   /Users/iurysouza/.pi/artifacts
```

## VA-5 — P2 — docs and base URL drift

Status: **verified real**.

Files/lines:
- `README.md:23,41,84,125-129` still documents `vaz-*` wrappers.
- `README.md:59,73,87,104,137` still documents `~/.pi/artifacts`.
- `README.md:101,147` documents `pnpm serve` and `pnpm test:contract`, absent from `skill/app/package.json` scripts.
- `README.md:134-138` documents old `VISUALIZER_*` env vars.
- `skill/SKILL.md:152` documents `VISUAL_ARTIFACT_BASE_URL` as preferred artifact link base.
- `skill/cli/src/config.ts:72` reads `baseUrl`, but `skill/cli/src/commands/create.ts:112` and `skill/cli/src/commands/open.ts:22` build URLs with `localBaseUrl(config)` instead.

Why it matters:
- User-facing install/run instructions point to removed or legacy commands.
- Sharing links cannot use the documented base URL.

Base URL repro:

```text
VISUAL_ARTIFACT_BASE_URL=https://share.example/artifacts visual-artifact --json --quiet create /tmp/spec.json --no-serve

"url": "http://127.0.0.1:9999/artifacts/visualizer/verify-base-url/"
```

## Not re-raised

- `serve stop` cannot stop detached server: known caveat from prior session, excluded.
- Impeccable skill findings: out of scope.
- `prose.tone` schema/manifest/adapter sync: no issue found in bounded review.
- renderer `skill/app/src/lib/artifacts.ts` discovery: no issue found in bounded review.
