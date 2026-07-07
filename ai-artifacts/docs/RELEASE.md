# Release process

Releases are fully automated via GitHub Actions. Pushing a `v*` tag builds cross-platform binaries and publishes them to GitHub Releases.

## Cut a release

1. **Bump the version** (optional — skip if you want to re-release the same version).
   Edit `cli/src/version.ts`:
   ```ts
   export const VERSION = "0.2.0"
   ```
   Commit and push the change.

2. **Tag and push**.
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. **GitHub Actions builds and publishes**.
   The workflow runs on `macos-latest` and produces:
   - `install.sh`
   - `latest.json`
   - `visual-artifact-macos-aarch64.tar.gz`
   - `visual-artifact-macos-x86_64.tar.gz`
   - `visual-artifact-linux-aarch64.tar.gz`
   - `visual-artifact-linux-x86_64.tar.gz`

   It then creates a GitHub release and uploads those files as release assets.

4. **Share the install command**.
   ```bash
   curl -fsSL https://github.com/iurysza/visual-artifact-renderer/releases/latest/download/install.sh | sh
   ```

## What gets installed

The installer downloads the right archive for the user's OS/arch and copies:

| Source in archive | Destination |
|---|---|
| `visual-artifact` | `~/.local/bin/visual-artifact` |
| `out/` | `~/.local/share/visual-artifact/app/out` |
| `skill/` | `~/.agents/skills/visual-artifact/` |
| `pi-extension/visual-artifact.ts` | `~/.pi/agent/extensions/visual-artifact.ts` |

## Rebuild locally

To generate release files without publishing:

```bash
cd cli
bun run release
```

Output lands in `releases/`.

## Overriding a release

If you need to replace an existing tag (e.g. fix `v0.1.0`):

```bash
git tag -d v0.1.0
git push --delete origin v0.1.0
git tag v0.1.0
git push origin v0.1.0
```

This deletes and recreates the GitHub release with fresh artifacts.
