## Why

Visualizer needs remote publishing that works for other people, not only this repo, this machine, or one maintainer-owned domain. A user should be able to plug in their own Cloudflare credentials, run setup once, and share artifacts at a durable public URL.

## What Changes

- Add a BYO Cloudflare setup path centered on `visual-artifact setup cloudflare`.
- Configure user-owned Cloudflare resources: Worker, R2 bucket, URL mode, and local publish profile.
- Make `workers.dev` the default shareable URL; keep custom domains optional.
- Add a publish profile model so `visual-artifact create --publish --json` returns the remote public URL after upload.
- Keep local-only `visual-artifact create` behavior unchanged.
- Keep hosted annotations read-only for MVP.
- Avoid hardcoded maintainer domains, repo-local secrets, or generated credentials in tracked files.

## Capabilities

### New Capabilities

- `cloudflare-publishing`: BYO Cloudflare setup, publish profile resolution, R2 artifact bundle upload, remote URL contract, shell-only Worker deployment, workers.dev quickstart, optional custom domain, safe credential handling, and read-only hosted annotations.

### Modified Capabilities

- None. No existing OpenSpec capabilities exist in this repo yet.

## Impact

- CLI: `cli/src/main.ts`, future setup/publish command modules, config/profile loading, `create --publish` behavior.
- Renderer: cloud-safe static export and shell fallback behavior under `app/`.
- Worker: future Cloudflare Worker package for static assets, R2 reads, indexes, and annotation mutation stubs.
- Pi extension: should keep returning CLI JSON `url`; publish success must make that URL remote.
- Docs: README, skill docs, ADR-0009, and Cloudflare goal package references.
