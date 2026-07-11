# Annotations

> Persistent comments and in-memory AI review on rendered artifacts.

Artifacts support 2 review modes from the page header: **Comments** and **Colab**. Use this page for review behavior and persistence rules. For the React components behind the UI, see the [`frontend guide`](./FRONTEND.md). For hosted writes, see [`Publishing`](./publishing.md).

## Comments

Comments are persistent node-level threads. Use them when humans need to discuss, resolve, or revisit feedback on a rendered artifact.

Basic flow:

1. Open an artifact.
2. Select **Comments** in the header.
3. Click a rendered node to anchor a thread.
4. Write a comment and post it from the sidebar.
5. Reply, resolve, or reopen the thread from the same sidebar.

Each thread is anchored to a rendered node. Thread badges update live while comment mode is open.

## AI Colab

AI Colab is for temporary formatter or agent suggestions. It lets an agent attach proposed comments without writing them to disk.

Use Colab to:

- review AI-suggested comments
- edit or delete suggestions before sharing them
- add new temporary comments
- copy the artifact plus current comments as Markdown

Colab comments live in browser state. The current flow never saves them to `annotations.json`.

## Persistence

Local artifacts are stored as bundles under the configured artifacts directory, which is the source repo's `artifacts/` in development or the installed skill's `artifacts/` by default:

```text
<artifacts-dir>/<project>/<slug>/
  artifact.json
  annotations.json
  publish.json   # present after successful --publish
  assets/
```

The local `visual-artifact serve` process persists annotation edits because it runs on your machine and can write to the artifact bundle. Reads and mutations return 404 unless `artifact.json` exists. Mutations are serialized per artifact, then written through a same-directory mode-`0600` temp file, fsync, and atomic rename; failed writes clean up the temp file.

The writable local server binds only to loopback by default. A non-loopback host requires global `--allow-remote` or strict `VISUAL_ARTIFACT_ALLOW_REMOTE=1`. Mutation routes accept only POST JSON and reject cross-origin browser evidence; loopback-to-loopback traffic is allowed for the Next dev proxy. This is cross-site request protection, not authentication.

Ordinary static hosting can only serve `artifact.json` and `annotations.json`. Published Cloudflare artifacts persist hosted comments through the Worker and R2. The Worker requires the artifact to exist and retries conditional writes against the latest etag up to five times, returning 409 if conflicts never settle.

## Authors

Local author identity comes from git config:

```bash
git config user.name
git config user.email
```

If no git identity is available, Visual Artifact Renderer uses a local anonymous fallback. Published Worker comments also use a fallback label because the Worker cannot read the viewer's git config.

## Sharing

Use **Copy link** in the sidebar to copy the artifact page URL.

For public links, publish the artifact instead of sharing a local `127.0.0.1` URL. Hosted comments currently have no user authentication or rate limiting; anyone who can load the page can submit same-origin comments. See [`Publishing`](./publishing.md).

## Related

- [`CLI`](./cli.md) for runtime paths and server roles.
- [`Frontend guide`](./FRONTEND.md) for annotation and AI Colab components.
- [`Architecture`](../ARCHITECTURE.md) for annotation mutation flow.
- [`Publishing`](./publishing.md) for hosted comments through Worker and R2.
