# Publishing

> Publish artifacts to Cloudflare under your own account.

Publishing turns a local artifact bundle into a durable public URL. The CLI writes locally first, uploads the bundle to R2, and returns a remote page served by a Cloudflare Worker.

Use this page for setup and deploys. For the command surface, see [`CLI`](./cli.md). For hosted comments, see [`Annotations`](./annotations.md). For release publishing, see [`Release`](./RELEASE.md).

## Requirements

You need:

- a Cloudflare account
- an R2 access key and secret
- a Worker deployment for the renderer
- a public base URL, usually `https://<worker>.<subdomain>.workers.dev`

The default R2 bucket is `visual-artifact-renderer`.

## One-time setup

Create `.env` from the example and add your R2 credentials:

```bash
cp .env.example .env
# fill in VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID
# fill in VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY
```

Configure the Cloudflare profile:

```bash
visual-artifact setup cloudflare \
  --account-id <id> \
  --workers-dev-subdomain <subdomain>
```

`setup cloudflare` also patches `worker/wrangler.jsonc` so the Worker's R2 binding matches the chosen bucket. If you change the bucket, rerun setup.

Override the bucket with:

```bash
visual-artifact setup cloudflare --bucket <name>
```

or set:

```bash
VISUAL_ARTIFACT_CLOUDFLARE_R2_BUCKET=<name>
```

## Deploy the Worker

Build the renderer for Cloudflare:

```bash
cd app
pnpm build:cloud
```

Deploy the Worker:

```bash
cd ../worker
bun install
bun run deploy
```

Run a smoke test after deploy:

```bash
cd worker
bun run smoke:deploy https://<worker>.<subdomain>.workers.dev
```

## Publish an artifact

Once the Worker is deployed, publishing is just the create flow with `--publish`:

```bash
visual-artifact create my-spec.json --publish
```

With JSON output:

```bash
visual-artifact --json create my-spec.json --publish
```

On success, `url` is the remote public page:

```text
https://<worker>.<subdomain>.workers.dev/<project>/<slug>/
```

`localUrl` is included for debugging.

The CLI writes `publish.json` beside `artifact.json`. It stores non-secret publish state only. Secrets stay in environment variables. Publish profiles are stored under:

```text
~/.config/visual-artifact/publish-profiles/
```

with file mode `0600`.

## GitHub Actions deploy

The repo includes `.github/workflows/deploy-cloudflare.yml`. It deploys the Worker on published releases and can run manually with `workflow_dispatch`.

Setup:

1. Create a Cloudflare API token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Use the **Edit Cloudflare Workers** template.
3. In GitHub, open **Settings** → **Environments** → **production**.
4. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

After merging, run **Actions** → **Deploy Cloudflare Worker**.

## Hosted comments

Comments on published artifacts are persisted by the Worker to R2, so shared URLs support threaded annotations. The author uses a local fallback label because the Worker cannot access the viewer's git identity.

For local comment behavior, see [`Annotations`](./annotations.md).

## Cloudflare environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VISUAL_ARTIFACT_CLOUDFLARE_R2_BUCKET` | `visual-artifact-renderer` | R2 bucket for published artifact bundles. |
| `VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID` | — | R2 S3-compatible access key ID. |
| `VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY` | — | R2 S3-compatible secret access key. |
| `VISUAL_ARTIFACT_CLOUDFLARE_ACCOUNT_ID` | — | Cloudflare account ID. |
| `VISUAL_ARTIFACT_CLOUDFLARE_BASE_URL` | — | Public base URL for published artifacts. |
| `VISUAL_ARTIFACT_CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` | — | workers.dev subdomain used to build the quickstart base URL. |
| `VISUAL_ARTIFACT_CLOUD_ROUTE_STRATEGY` | `zero-pages` | Cloud build route strategy: `zero-pages` or `placeholder`. |

## Related

- [`CLI`](./cli.md) for `create --publish`, output modes, and runtime paths.
- [`Annotations`](./annotations.md) for hosted comment persistence.
- [`Architecture`](../ARCHITECTURE.md) for storage and URL contracts.
- [`Release`](./RELEASE.md) for maintainer release flow.
