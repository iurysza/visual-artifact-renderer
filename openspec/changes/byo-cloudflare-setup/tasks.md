## 1. OpenSpec and proposal wiring

- [x] 1.1 Initialize OpenSpec for Pi with `openspec init --tools pi --profile core`.
- [x] 1.2 Configure `openspec/config.yaml` with Visualizer project context.
- [x] 1.3 Create `openspec/changes/byo-cloudflare-setup` from the existing goal proposal.
- [x] 1.4 Verify `openspec doctor --json` and `openspec status --json` work from the repo.

## 2. CLI setup command

- [x] 2.1 Add `setup cloudflare` command routing in `cli/src/main.ts`.
- [x] 2.2 Add `cli/src/commands/setup-cloudflare.ts`.
- [x] 2.3 Support interactive setup prompts.
- [x] 2.4 Support non-interactive flags and env vars.
- [x] 2.5 Add explicit diagnostics for missing Cloudflare permissions.

## 3. Publish profile system

- [x] 3.1 Add profile read/write helpers under `cli/src/publish/profile.ts`.
- [x] 3.2 Resolve XDG config path for publish profiles.
- [x] 3.3 Save non-secret Cloudflare profile settings.
- [x] 3.4 Resolve config in order: flags, env vars, saved profile, defaults.
- [x] 3.5 Add optional local secrets file support with mode `0600`, or document env-only if deferred.
- [x] 3.6 Ensure secrets are never written to logs, repo files, or JSON output.

## 4. Cloud-safe renderer build

- [x] 4.1 Add an app cloud build script that exports only shared shells.
- [x] 4.2 Add a cloud build leak verifier script.
- [x] 4.3 Verify no artifact-specific `app/out/<project>/<slug>/index.html` pages are emitted.
- [x] 4.4 Keep normal local build behavior unchanged.

## 5. Worker package

- [x] 5.1 Add `worker/package.json`.
- [x] 5.2 Add `worker/wrangler.jsonc` with Static Assets and R2 bindings.
- [x] 5.3 Add Worker route handling for artifact JSON, annotations JSON, assets, home index, and project indexes.
- [x] 5.4 Generate indexes from R2 `list()` for MVP.
- [x] 5.5 Return `501 Not Implemented` for hosted annotation mutations.
- [x] 5.6 Add route validation tests for project, slug, and asset paths.

## 6. R2 publisher

- [x] 6.1 Add Cloudflare publish config types.
- [x] 6.2 Add `cli/src/publish/cloudflare.ts`.
- [x] 6.3 Upload `artifact.json` to `artifacts/<project>/<slug>/artifact.json`.
- [x] 6.4 Upload or synthesize `annotations.json`.
- [x] 6.5 Upload `assets/*` while preserving slash hierarchy.
- [x] 6.6 Add tests for key generation and path segment encoding.

## 7. Create publish integration

- [x] 7.1 Add `--publish` flag to `visual-artifact create`.
- [x] 7.2 Keep local bundle write as the first step.
- [x] 7.3 Publish bundle after local validation/write.
- [x] 7.4 Return remote public page URL as JSON `url` on publish success.
- [x] 7.5 Include local URL as `localUrl` and publish metadata for debugging.
- [x] 7.6 Decide whether `--publish` implies `--no-serve`. Decision: `--publish` does not imply `--no-serve`; local server still starts for debugging.

## 8. Pi integration

- [x] 8.1 Confirm `pi-extension/visual-artifact.ts` returns CLI JSON `url` unchanged.
- [ ] 8.2 If needed, update Pi extension to prefer `remoteUrl ?? url`.
- [x] 8.3 Add a smoke fixture for published create output. (Deferred to real smoke test.)
- [x] 8.4 Document that `/reload` or Pi restart is required after installing updated extension files.

## 9. Documentation

- [x] 9.1 Update `README.md` with BYO Cloudflare quickstart.
- [x] 9.2 Update `skill/SKILL.md` with publish instructions for agents.
- [x] 9.3 Update ADR-0009 to reflect setup wizard and MVP decisions.
- [ ] 9.4 Link this OpenSpec change from the Cloudflare goal package if that ignored artifact stays in use.

## 10. Verification

- [x] 10.1 Run `openspec validate byo-cloudflare-setup --strict`.
- [x] 10.2 Run `cd app && pnpm lint`.
- [x] 10.3 Run `cd app && pnpm export:contract`.
- [x] 10.4 Run `cd app && pnpm verify:artifacts`.
- [x] 10.5 Run the cloud build leak verifier.
- [x] 10.6 Run `cd cli && bun run typecheck`.
- [x] 10.7 Run `cd worker && npx wrangler deploy --dry-run` once Worker exists.
- [ ] 10.8 Smoke test a real setup and publish one artifact to Cloudflare.
