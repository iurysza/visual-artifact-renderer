# Research: Pragmatic changelog/release tools for a small Bun/TypeScript project

## Summary
For a small open-source Bun/TypeScript repo that already uses Conventional Commits and wants GitHub Releases markdown with minimal fuss, **release-please** is the lowest-friction end-to-end option (maintained by Google, no project dependencies, creates release PRs that bump `package.json`, generate `CHANGELOG.md`, tag, and draft a GitHub Release). If you prefer full control, avoid Personal Access Tokens, or want a non-Node runtime, **git-cliff** is the best runner-up: a single Rust binary that generates excellent changelogs, but requires a couple of extra workflow steps to bump/tag/create the release.

## Findings

1. **release-please — easiest full-coverage GitHub-native workflow** — The `googleapis/release-please-action@v4` action parses Conventional Commits and maintains a release PR that updates `CHANGELOG.md`, bumps `package.json`, and (on merge) creates a git tag and GitHub Release. It is the officially recommended replacement for deprecated `standard-version`. [Source](https://github.com/googleapis/release-please-action/blob/main/README.md)

2. **release-please caveats** — It needs a GitHub Personal Access Token (PAT) as the default `GITHUB_TOKEN` won’t trigger downstream workflows on the release PR or release. It also uses a PR-based release gate, which is great for review but adds one manual merge step. [Source](https://github.com/googleapis/release-please-action/blob/main/README.md)

3. **git-cliff — most customizable and zero runtime dependencies** — `orhun/git-cliff-action@v4` generates a Markdown changelog from git history using Conventional Commits and a `cliff.toml` Tera template. The binary is ~12 MB and does not add Node dependencies to the project. It can also compute the bumped version via `git-cliff --bumped-version` for tagging. [Source](https://github.com/orhun/git-cliff-action/blob/main/README.md), [Source](https://archlinux.org/packages/extra/x86_64/git-cliff/)

4. **git-cliff does not auto-release by itself** — The action produces changelog text/file; you must wire extra steps (or another action) to update `package.json`, create the git tag, and publish the GitHub Release. Several public workflows show this pattern. [Source](https://github.com/orhun/git-cliff-action/blob/main/README.md)

5. **semantic-release — powerful but heavy** — It fully automates version bump, changelog, tag, GitHub Release, and even npm publish via plugins. However, it pulls ~46–52 MB of npm dependencies and has a steeper plugin/config surface. It is overkill if the goal is simply a changelog + GitHub Release. [Source](https://github.com/semantic-release/semantic-release/blob/master/README.md), [Source](https://www.npmjs.com/package/semantic-release)

6. **Changesets — great for monorepos, less ideal for single-package conventional-commit flow** — Uses human-written changeset files rather than commit messages to drive versioning. For a project already disciplined with Conventional Commits, it adds contributor friction and ~16 MB of Node deps. [Source](https://github.com/changesets/action/blob/main/README.md), [Source](https://www.npmjs.com/package/@changesets/cli)

7. **conventional-changelog-action — lightweight action that bumps/tags/changelogs** — `TriPSs/conventional-changelog-action@v5/v6` is a pre-compiled GitHub Action that bumps `package.json`, tags, and writes `CHANGELOG.md` in one step. It is simpler than semantic-release but less flexible and has fewer customization options than git-cliff or release-please. [Source](https://github.com/TriPSs/conventional-changelog-action/blob/releases/v6/README.md)

8. **changelogen — tiny modern Node alternative** — UnJS’s `changelogen` is ~4 MB with 13 deps and supports `--bump`, `--release`, and GitHub release sync. It is attractive for Node projects, but it is primarily a CLI and has less mature GitHub Actions ecosystem coverage than release-please or git-cliff. [Source](https://github.com/unjs/changelogen/blob/main/README.md), [Source](https://www.npmjs.com/package/changelogen)

9. **standard-version is deprecated** — npm lists it as deprecated and recommends release-please for GitHub users. Do not start new projects on it. [Source](https://www.npmjs.com/package/standard-version)

## Comparison table

| Tool | Setup complexity | GH Actions integration | Dependency weight | Customization | Version bump + tag | Best for |
|------|------------------|------------------------|-------------------|---------------|--------------------|----------|
| **release-please** | Low (one workflow) | Native action | Zero project deps | Moderate (config JSON, release types) | Yes, via release PR + merge | GitHub-centric single-package projects |
| **git-cliff** | Medium (workflow + `cliff.toml` + tag step) | Native action | ~12 MB Rust binary | Very high (Tera templates) | No (changelog only; you add bump/tag) | Custom output / non-Node / minimal deps |
| **semantic-release** | Medium-High (plugins + config) | Community actions or `npx` | ~46–52 MB npm | Very high (plugin ecosystem) | Yes | Full CI/CD automation incl. npm publish |
| **Changesets** | Medium (`.changeset` folder + action) | `changesets/action@v2` | ~16 MB npm | Moderate | Yes (manual changeset files) | Monorepos / human-curated release notes |
| **conventional-changelog-action** | Low (one action) | Native action | Pre-compiled action | Low-Moderate | Yes | Drop-in replacement for standard-version |
| **changelogen** | Low-Medium (CLI, optional action) | Community actions | ~4 MB npm | Moderate | Yes (`--release`) | Lightweight Node projects |

## Recommendation

**Primary: release-please**
- Already uses Conventional Commits ✅
- One official action handles changelog, version bump, tag, and GitHub Release ✅
- No local dependencies, simple for small open-source projects ✅
- Downside: needs a PAT and a release-PR merge step.

**Runner-up: git-cliff**
- Best if you want deterministic, beautiful changelogs and don’t want PAT/workflow-trigger complexity.
- Requires wiring the bump/tag/release steps yourself, but the result is very flexible.

## Next-step commands

### Option A — release-please (recommended)

1. Create `.github/workflows/release-please.yml`:

```yaml
on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
          release-type: node
```

2. Create a fine-grained Personal Access Token with `contents:write` and `pull-requests:write`, add it as repository secret `RELEASE_PLEASE_TOKEN`.
3. Ensure `package.json` has a valid `version` and commits follow Conventional Commits.
4. (Optional) Add a conditional `npm publish` job after the release PR merges:

```yaml
      - if: ${{ steps.release.outputs.release_created }}
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Option B — git-cliff

1. Install locally to scaffold config:

```bash
curl -fsSL https://git-cliff.org/install.sh | sh
# or: cargo install git-cliff

git-cliff --init
git add cliff.toml
git commit -m "ci: add git-cliff config"
```

2. Create `.github/workflows/release.yml`:

```yaml
on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: orhun/git-cliff-action@v4
        id: cliff
        with:
          config: cliff.toml
          args: --verbose
        env:
          OUTPUT: CHANGELOG.md
          GITHUB_REPO: ${{ github.repository }}

      - name: Bump version and create release
        run: |
          VERSION=$(git-cliff --bumped-version)
          npm version "${VERSION}" --no-git-tag-version
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add package.json CHANGELOG.md
          git commit -m "chore(release): ${VERSION}"
          git tag "v${VERSION}"
          git push origin main --tags
          gh release create "v${VERSION}" \
            --title "v${VERSION}" \
            --notes-file CHANGELOG.md
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

3. Adjust the `gh release create` step to use only the latest-version section if you don’t want the full changelog as release notes.

## Sources

- Kept: `googleapis/release-please-action` README (https://github.com/googleapis/release-please-action/blob/main/README.md) — authoritative setup and PAT caveat.
- Kept: `orhun/git-cliff-action` README (https://github.com/orhun/git-cliff-action/blob/main/README.md) — action usage, inputs/outputs, examples.
- Kept: `semantic-release` README (https://github.com/semantic-release/semantic-release/blob/master/README.md) — scope and automation model.
- Kept: `semantic-release` npm page (https://www.npmjs.com/package/semantic-release) — install size and dependency count.
- Kept: `changesets/action` README (https://github.com/changesets/action/blob/main/README.md) — workflow model.
- Kept: `@changesets/cli` npm page (https://www.npmjs.com/package/@changesets/cli) — dependency weight.
- Kept: `TriPSs/conventional-changelog-action` README (https://github.com/TriPSs/conventional-changelog-action/blob/releases/v6/README.md) — inputs, outputs, bump/tag behavior.
- Kept: `unjs/changelogen` README (https://github.com/unjs/changelogen/blob/main/README.md) — CLI options and GitHub release sync.
- Kept: `changelogen` npm page (https://www.npmjs.com/package/changelogen) — package size/deps.
- Kept: `standard-version` npm page (https://www.npmjs.com/package/standard-version) — deprecation notice.
- Kept: Arch Linux `git-cliff` package page (https://archlinux.org/packages/extra/x86_64/git-cliff/) — binary size reference.

- Dropped: Generic 2025 “best tools” listicles and blog roundups — useful for orientation but less authoritative than official READMEs/npm pages.
- Dropped: `standard-version` deep docs — deprecated, included only for the caveat.

## Gaps

- No hands-on test was run in this repo, so workflow snippets should be validated in a branch or fork before trusting them with real releases.
- Bun-specific lockfile (`bun.lockb`) updates: none of these tools natively bump Bun lockfiles; `release-please` updates `package.json` only, and `git-cliff` manual flow would need an explicit `bun install` or lockfile commit step if desired.
- release-please PAT requirement: the exact token scopes and whether a fine-grained token works with the action should be confirmed against the repo’s current organization settings.

## Supervisor coordination

No supervisor contact needed; research is complete and written to disk.
