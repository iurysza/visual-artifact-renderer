# Roadmap

> Feature ideas worth keeping, not promises.

## Deploy without cloning the repo

Make Cloudflare deployment available from the installed CLI, so a user can go from local install to public publishing without cloning the source repo.

Target flow:

```bash
visual-artifact setup cloudflare
visual-artifact deploy cloudflare
visual-artifact create my-spec.json --publish
```

Possible combined flow:

```bash
visual-artifact deploy cloudflare --setup
```

What the CLI would do:

1. collect account ID, Worker name, bucket, and public base URL
2. verify Cloudflare credentials and R2 access
3. create a temporary deploy directory from bundled release assets
4. write `wrangler.jsonc` from a template
5. deploy the Worker and static renderer assets
6. save the publish profile
7. run a smoke test
8. print the next command to publish an artifact

Release bundle needs:

- compiled `visual-artifact` binary
- local static renderer export
- Cloudflare static renderer export
- Worker source or bundled Worker entry
- `wrangler.jsonc` template

First implementation can shell out to `wrangler`. That keeps the feature small and close to the current deployment path. A later version can use Cloudflare APIs directly if removing the Wrangler dependency is worth the complexity.

Related docs:

- [`CLI`](./cli.md)
- [`Publishing`](./publishing.md)
- [`Architecture`](../ARCHITECTURE.md)
