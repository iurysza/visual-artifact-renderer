## ADDED Requirements

### Requirement: Cloudflare setup wizard

The CLI SHALL provide `visual-artifact setup cloudflare` to configure remote publishing for a user-owned Cloudflare account.

#### Scenario: first-time interactive setup

- **WHEN** a user runs `visual-artifact setup cloudflare`
- **THEN** the CLI guides them through account, bucket, Worker, URL, and credential setup
- **AND** saves a local publish profile
- **AND** prints the remote base URL future publishes will use.

#### Scenario: non-interactive setup

- **WHEN** a user runs `visual-artifact setup cloudflare --non-interactive` with all required flags and environment variables
- **THEN** the CLI performs setup without prompts
- **AND** fails clearly if any required value is missing.

### Requirement: User-owned publishing profile

The CLI SHALL support a local Cloudflare publish profile containing non-secret deployment settings.

#### Scenario: profile used by publish

- **WHEN** a valid Cloudflare profile exists and the user runs `visual-artifact create spec.json --publish --json`
- **THEN** the CLI uploads the artifact bundle to the configured Cloudflare R2 bucket
- **AND** returns a public remote artifact URL.

#### Scenario: missing profile

- **WHEN** no Cloudflare profile exists and the user runs `visual-artifact create spec.json --publish`
- **THEN** the CLI fails with a clear message telling the user to run `visual-artifact setup cloudflare`.

### Requirement: Workers.dev quickstart

The setup flow SHALL support a default `workers.dev` URL mode so users can share without DNS setup.

#### Scenario: no custom domain

- **WHEN** the user chooses the quickstart path during setup
- **THEN** the saved profile uses a `workers.dev` base URL
- **AND** future publishes return URLs under that base URL.

### Requirement: Optional custom domain

The setup flow SHALL allow a custom public base URL for users who already have a Cloudflare-managed domain.

#### Scenario: custom domain provided

- **WHEN** the user provides `https://viz.example.com/artifacts` as the base URL
- **THEN** the saved profile uses that URL for future publish output.

### Requirement: No hardcoded maintainer domain

Remote publishing SHALL NOT hardcode a project-owned or maintainer-owned domain.

#### Scenario: different users publish to different domains

- **WHEN** User A configures `https://a.example.workers.dev/artifacts` and User B configures `https://b.example.workers.dev/artifacts`
- **THEN** each user's publish command returns the URL from that user's own profile.

### Requirement: Shell-only cloud deploy

The setup flow SHALL build or deploy a shell-only renderer that does not include local artifact-specific pages.

#### Scenario: cloud build guard

- **WHEN** the setup command builds the renderer for Cloudflare
- **THEN** no `app/out/<project>/<slug>/index.html` artifact pages are present
- **AND** shell fallback pages are present.

### Requirement: Remote publish URL contract

When publishing succeeds, the CLI JSON `url` field SHALL be the remote public page URL.

#### Scenario: Pi receives shareable URL

- **WHEN** Pi calls `visual-artifact create - --project <cwd> --json` and remote publishing is enabled
- **THEN** the parsed `url` field points to the remote artifact page, not localhost.

### Requirement: Safe credential handling

The CLI SHALL avoid writing credentials into repository files or logs.

#### Scenario: secrets saved locally

- **WHEN** the user explicitly opts into saving secrets locally
- **THEN** setup writes credential material outside the repo under XDG config with restrictive file permissions
- **AND** prints a warning explaining where the secrets live.

#### Scenario: secrets from environment

- **WHEN** required secret environment variables are present
- **THEN** setup and publish use them without persisting them.

### Requirement: Read-only hosted annotations in MVP

Hosted artifacts SHALL serve annotation documents but SHALL NOT allow remote annotation mutation in MVP.

#### Scenario: mutation attempted on hosted artifact

- **WHEN** the browser posts to `/artifacts/api/annotations/<project>/<slug>` for a hosted artifact
- **THEN** the Worker returns `501 Not Implemented`
- **AND** the UI does not claim the comment was saved.
