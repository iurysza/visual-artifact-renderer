# Release process

Releases are automated with [release-please](https://github.com/googleapis/release-please). Root `package.json` is the version source of truth; `cli/src/version.ts` reads from it at runtime. Merging a release PR bumps the version, writes `CHANGELOG.md`, creates a git tag, and publishes a GitHub Release. Release creation, asset upload, and Cloudflare deployment all depend on the reusable verification gate; release-event verification protects assets/deploy because the GitHub Release already exists when those workflows start.

## Setup (one-time)

Create a fine-grained Personal Access Token (PAT) with `contents:write` and `pull-requests:write` permissions for this repository, then add it as the repository secret `RELEASE_PLEASE_TOKEN`.

release-please needs a PAT because the default `GITHUB_TOKEN` cannot trigger downstream workflows on the release PR it creates.

## Cut a release

1. **Merge changes to `main` using Conventional Commits.**
   Use prefixes like `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, etc.

2. **Wait for the release PR.**
   The `Release Please` workflow opens a release PR that:
   - Bumps root `package.json`
   - Bumps `cli/package.json`, `cli/src/version.ts`, `shared/package.json`, and `app/package.json`
   - Updates `CHANGELOG.md`
   - Updates `.release-please-manifest.json`

3. **Merge the release PR.**
   release-please then creates a tag and GitHub Release with generated notes.

4. **Assets upload automatically after verification.**
   The `Release` workflow triggers on the published release, reruns the pinned dual-OS reusable gate, then builds on `macos-15-intel` and uploads:
   - `install.sh`
   - `latest.json`
   - `visual-artifact-macos-aarch64.tar.gz`
   - `visual-artifact-macos-x86_64.tar.gz`
   - `visual-artifact-linux-aarch64.tar.gz`
   - `visual-artifact-linux-x86_64.tar.gz`

   Verification uses Node 22.22.3, Bun 1.1.34, pnpm 11.5.2, frozen lockfiles, native CLI smoke on Linux x64 and macOS x64, the complete app suite, contract drift checks, artifact verification, health smoke, and Worker tests.

5. **Cloudflare deploys after the same gate.**
   The release-triggered deploy workflow verifies again before building and deploying the Worker. Manual deployment uses the selected `github.ref` when no release tag exists.

6. **Share the install command.**
   ```bash
   curl -fsSL https://github.com/iurysza/visual-artifact-renderer/releases/latest/download/install.sh | sh
   ```

## What gets installed

The installer downloads the right archive for the user's OS/arch and copies:

| Source in archive | Destination |
|---|---|
| `visual-artifact` | `~/.local/bin/visual-artifact` |
| `out/` | `~/.local/share/visual-artifact/app/out` |

Release archives contain the CLI and static renderer. Pi installs the extension and skill with `pi install git:github.com/iurysza/visual-artifact-renderer[@ref]`; other compatible agents install the skill with `npx skills`. Root `package.json` declares `pi.extensions` and `pi.skills`, so Pi owns discovery, updates, filtering, and removal. Before release, smoke-test the package locally and confirm the release tag used in documentation exists before sharing a pinned command.

## Rebuild locally

To generate release files without publishing:

```bash
cd cli
bun run release
```

Output lands in `releases/`.

## Overriding a release

If a release needs fixing:

1. Revert or fix the problem on `main`.
2. Delete the tag and GitHub release.
3. Reset `.release-please-manifest.json` to the previous version if needed.
4. Let release-please open a new release PR, then merge it.

Avoid force-pushing tags; release-please owns version bumps and tag creation.
