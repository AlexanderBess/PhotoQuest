# Development Setup

This document will be completed as the toolchain is selected and implemented in slices S0–S1 (PQ-002 – PQ-007). Commands below exist today unless marked otherwise. Commands are written for PowerShell on native Windows.

## Prerequisites

| Tool | Version | Where it is pinned | Install on Windows |
| --- | --- | --- | --- |
| Git | any recent | — | https://git-scm.com/ |
| Go | 1.27.3 | `backend/go.mod` (`go 1.27`, `toolchain go1.27.3`) | https://go.dev/dl/ |
| Node.js | 26.13.0 (LTS) | `.node-version`; `engines.node` in `frontend/package.json` (`>=26.13.0 <27`) | `nvm install 26.13.0`, `nvm use 26.13.0`, or https://nodejs.org/dist/v26.13.0/ |
| pnpm | 12.15.0 | `packageManager` in `frontend/package.json` | `npm install -g pnpm@12.15.0` |
| Task (go-task) | 3.54.0 (exact) | `REQUIRED_TASK_VERSION` in `Taskfile.yml` | https://github.com/go-task/task/releases |
| golangci-lint | 2.15.0 (built with go1.27.0) | `GOLANGCI_LINT_VERSION` in `Taskfile.yml` | Official binary with the checksum-verifying script in `docs/analysis/pq-002-implementation-plan.md`, section 2.1; `go install` is not supported upstream |
| Docker Desktop | 4.98.0 or newer (verified with Engine 29.9.2, Compose v5.6.1) | — (container images are pinned in `compose.yaml`) | Per-user install with the WSL 2 backend: https://docs.docker.com/desktop/setup/install/windows-install/ |

- The `go` directive is the minimum Go version the module requires; the `toolchain` line names the suggested toolchain for this main module. With the default `GOTOOLCHAIN=auto`, Go 1.21 or newer downloads and switches to it when the local toolchain is older. CI installs exactly the `toolchain` version and sets `GOTOOLCHAIN=local`, so it never switches silently.
- Node 25+ no longer bundles Corepack, so pnpm is installed separately. pnpm refuses to install on a Node version outside `engines.node` (`engineStrict`).
- `task tools:verify` compares every installed tool with the version pinned in the repository (Go with the `toolchain` line, Node.js with `.node-version`, pnpm with `packageManager`, Task with `REQUIRED_TASK_VERSION`, golangci-lint with `GOLANGCI_LINT_VERSION`) and fails on any mismatch. CI runs it first in every job. `task lint` also checks the golangci-lint version first.
- Docker Desktop requires Windows 10 22H2 (build 19045) or Windows 11 23H2 (build 22631) or newer, hardware virtualization enabled in the BIOS/UEFI (SVM on AMD, VT-x on Intel) and WSL 2.1.5 or newer (`wsl --install --no-distribution` in an elevated terminal). The Docker VM takes about half of the RAM by default; it can be limited in `%USERPROFILE%\.wslconfig`.

## One-time setup

From the repository root:

```powershell
git config core.autocrlf false
Copy-Item backend/.env.example backend/.env
cd frontend
pnpm install --frozen-lockfile
```

`.gitattributes` enforces LF in the repository (`* text=auto eol=lf`).

pnpm 11 and newer read their settings from `frontend/pnpm-workspace.yaml`, not from `.npmrc`. `allowBuilds` lists packages with install scripts: pnpm fails an install if one is not listed, and `esbuild` is denied because it runs from its prebuilt platform package.

## Local dependencies (Docker Compose)

`compose.yaml` in the repository root runs the services the backend depends on. The API, worker and frontend run natively (see Processes).

| Service | Image (tag and digest pinned in `compose.yaml`) | Host address | Health check |
| --- | --- | --- | --- |
| `postgres` | `postgres:18.6-trixie` | `127.0.0.1:5432` (`PQ_DB_PORT`) | `pg_isready` over TCP, so it does not pass while the init-only server runs |
| `storage` (**provisional**) | `chrislusf/seaweedfs:4.52`, single-process `mini` mode | `127.0.0.1:8333` (`PQ_S3_PORT`), S3 API only | Signed `HEAD` on the bucket (`curl --aws-sigv4`): gateway, credentials and bucket |

- **PostgreSQL 18** is the project's major version (D-17, decided in PQ-003). The database is created with UTF-8 encoding and the ICU root collation `und` (language-neutral, sorts Cyrillic correctly). Changing the collation later means re-creating the database (`task deps:reset`). No schemas or extensions are created here: logical schemas arrive with migrations in PQ-005.
- **Local S3 is provisional.** OD-13 stays open: PQ-007 runs the provider compatibility checks and confirms SeaweedFS or replaces it. Only `compose.yaml`, `backend/.env.example` and this document would change. The bucket `photoquest-local` is created on startup and is private: anonymous requests get `403`.
- Both ports bind to `127.0.0.1` only. The SeaweedFS admin UI and internal ports are not published.
- Data lives in the named volumes `photoquest_postgres-data` and `photoquest_storage-data`. `task deps:down` keeps them; `task deps:reset` deletes them after a confirmation prompt.
- Health-check timing [A]: every 5 s, timeout 3 s, 12 retries, 20 s start period. `task deps:up` waits up to 120 s [A] for both services to become healthy.
- Images are pinned by tag **and** digest. Updating an image means changing both and recording the new version here.

## Processes

Start the dependencies first with `task deps:up`, then run each process in its own terminal, from the repository root. Ctrl+C stops a process gracefully.

| Process | Command | Notes |
| --- | --- | --- |
| API (`backend/cmd/api`) | `task dev:api` | http://127.0.0.1:8080; `GET /healthz` returns `200 {"status":"ok"}` |
| Worker (`backend/cmd/worker`) | `task dev:worker` | Idle until PQ-006; will process `platform.jobs` (media processing, file deletion, AI analysis) |
| Frontend dev server (Vite) | `task dev:web` | http://localhost:5173; proxies `/api` and `/healthz` to the API |

The browser talks to one origin: the Vite proxy locally, a reverse proxy on staging and production. There is no CORS.

## Configuration

| Variable | Process | Default | Purpose |
| --- | --- | --- | --- |
| `PQ_ENV` | api, worker | `local` | `local` / `staging` / `production`; text logs locally, JSON elsewhere |
| `PQ_HTTP_ADDR` | api | `127.0.0.1:8080` | Listen address (`0.0.0.0:8080` inside containers later) |
| `PQ_LOG_LEVEL` | api, worker | `info` | `debug` / `info` / `warn` / `error`; an unknown value falls back to `info` until PQ-005 |
| `PQ_SHUTDOWN_TIMEOUT` | api, worker | `10s` [A] | Graceful-shutdown limit. The idle worker has nothing to drain and does not use it until PQ-006 |
| `VITE_ROBOTS_NOINDEX` | frontend build | `false` | `true` puts `<meta name="robots" content="noindex, nofollow">` into the built `index.html` |
| `PQ_DB_USER`, `PQ_DB_PASSWORD`, `PQ_DB_NAME` | `compose.yaml` | see `backend/.env.example` | PostgreSQL superuser and database created on first start |
| `PQ_DB_PORT` | `compose.yaml` | `5432` | Host port for PostgreSQL (bound to `127.0.0.1`) |
| `PQ_S3_ACCESS_KEY_ID`, `PQ_S3_SECRET_ACCESS_KEY` | `compose.yaml` | see `backend/.env.example` | Local S3 credentials |
| `PQ_S3_BUCKET` | `compose.yaml` | `photoquest-local` | Private bucket created on startup |
| `PQ_S3_PORT` | `compose.yaml` | `8333` | Host port for the S3 API (bound to `127.0.0.1`) |
| `PQ_DATABASE_URL` | — (reserved) | see `backend/.env.example` | Read from PQ-005 (database access) |
| `PQ_S3_ENDPOINT` | — (reserved) | `http://127.0.0.1:8333` | Read from PQ-007 (storage adapter) |

- `Taskfile.yml` loads `backend/.env` for every task (`dotenv`); a variable already set in the shell takes precedence. A missing file is ignored, except by `task deps:*`, which stops with a message. The `deps:*` tasks also pass the file to `docker compose --env-file`. Running `docker compose` without it fails with `required variable ... is missing a value`.
- HTTP server timeouts [A], in `backend/internal/app/api.go`: read header 5 s, read 15 s, write 30 s, idle 60 s.
- `vite.config.ts` reads `VITE_ROBOTS_NOINDEX` through Vite's `loadEnv`, so it can come from the shell or from a `.env` file; a variable set in the shell takes precedence. Staging and production are separate builds; production must be built without the flag (checked in PQ-054b).
- Validated configuration that fails fast arrives in PQ-005.

## Environments

- **Local:** Docker Compose (from PQ-003).
- **Staging** (from slice S1): invited testers only behind an access gate; public registration disabled; `noindex` headers, `robots.txt` disallow-all and meta tag; separate database, bucket, credentials and secrets; never shares data with production. Test-data and consent rules: `docs/analysis/implementation-roadmap.md`.
- **Production** (before the pilot gate): backups with tested restore, monitoring and alerts.

## Environment files

- `frontend/.env.example` and `backend/.env.example` are committed; `.env` and `.env.*` are git-ignored. Copy `backend/.env.example` to `backend/.env` once.
- The values in `backend/.env.example` are local-only placeholders. Staging and production use their own secrets (PQ-054a, PQ-054b).
- No real credentials in the repository, and no secrets in `VITE_*` variables.
- Required configuration validated at startup (from PQ-005).
- Safe local defaults documented (local storage endpoint, default UI locale `ru`).

## Commands

Available from the repository root:

| Command | What it does |
| --- | --- |
| `task deps:up` | Start PostgreSQL and the local S3 service; returns when both are healthy |
| `task deps:status` | Show the services and their health |
| `task deps:logs` | Follow the service logs |
| `task deps:down` | Stop the services; data is kept |
| `task deps:reset` | Delete the volumes (database and bucket contents) after a prompt; `task --yes deps:reset` skips it |
| `task dev:api`, `task dev:worker`, `task dev:web` | Run a process |
| `task test` | `go test ./...` and `pnpm test` |
| `task lint` | golangci-lint version check, `golangci-lint config verify` and `run` (in `backend/`), `pnpm lint`. `config verify` downloads its schema, so it needs network access |
| `task fmt` | `golangci-lint fmt` and `pnpm format` |
| `task build` | Backend binaries in `backend/bin/` and the frontend bundle in `frontend/dist/` |
| `task check` | **Every quality gate CI runs**, in order: `tools:verify`, `fmt:check`, `lint`, `typecheck`, `i18n:check`, `test`, `build`, `vuln`, `deps:config`, `check:eol`. Run it before opening a pull request |
| `task tools:verify` | Fail unless the installed tools match the pinned versions |
| `task fmt:check` | Fail if a Go file (`golangci-lint fmt --diff`) or a frontend file (`prettier --check`) is not formatted |
| `task typecheck` | `vue-tsc --build` |
| `task i18n:check` | Missing message keys, locale parity and raw Cyrillic strings (see Quality gates) |
| `task vuln` | `govulncheck` (backend) and `pnpm audit` (frontend); needs network access |
| `task deps:config` | Validate `compose.yaml` with `backend/.env.example` (ignores a local `backend/.env`); starts nothing |
| `task check:eol` | Fail if a file is committed with CRLF line endings |

Available from `frontend/`: `pnpm dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `format:check`, `test`, `i18n:check`.

`task test:go GO_TEST_FLAGS=-race` passes extra flags to `go test` (CI uses `-race` on Linux; the race detector needs cgo and a C compiler).

## Quality gates (PQ-004)

| Gate | Backend | Frontend |
| --- | --- | --- |
| Tool versions | `tools:verify:go` | `tools:verify:web` |
| Formatting | `golangci-lint fmt --diff` (gofmt, goimports) | Prettier |
| Lint | golangci-lint 2.15.0 (`backend/.golangci.yml`) | ESLint, incl. `vue/no-bare-strings-in-template` |
| Types | compiler | `vue-tsc --build` |
| i18n | — | `scripts/check-i18n.ts` |
| Tests | `go test` (`-race` on Linux); SIGTERM/SIGINT tests on Linux | Vitest |
| Build | `go build` | `vite build` |
| Vulnerabilities | govulncheck v1.9.0 | `pnpm audit` |
| Repository | `compose.yaml` validation, no CRLF in the index | |

**i18n check** (`pnpm i18n:check`, ADR-024). It fails when:
- a key passed as a string literal to `t`, `$t`, `te`, `$te`, `tm`, `$tm` or `<i18n-t keypath>` does not exist in `ru` (the file name is the first key segment: `common.json` → `common.…`);
- a key is not a string literal. Mark a deliberate dynamic key with a comment containing `i18n-dynamic-key` and a reason on the same line;
- another registered locale lacks keys of `ru` or has extra ones (plural forms may differ per language and are not compared);
- Cyrillic text appears in a string literal in `.ts` files or `<script>` blocks, or anywhere in a `<template>` outside HTML comments.

Keys that are never used literally are printed as warnings. `*.spec.ts` files are not scanned (tests use missing keys on purpose). Bare Latin text in templates is caught by ESLint's `vue/no-bare-strings-in-template`; Latin string literals in scripts are not detected.

**SIGTERM.** `backend/cmd/api/signal_unix_test.go` and `backend/cmd/worker/signal_unix_test.go` re-run the test binary as the real process, send SIGTERM and SIGINT and expect exit code 0 and the shutdown log lines. They build only on Unix (`//go:build unix`), so they run in Linux CI and are skipped on Windows.

## Continuous integration

GitHub Actions, `.github/workflows/`:

| Workflow | Trigger | Jobs |
| --- | --- | --- |
| `ci.yml` | pull requests to `main`, pushes to `main`, manual | `backend` and `frontend` on `ubuntu-24.04` **and** `windows-2025`; `vulnerabilities` (calls `vulnerabilities.yml`); `repository` (Linux); `ci` |
| `vulnerabilities.yml` | called by `ci.yml`; weekly (Mondays 03:00 UTC); manual | govulncheck and `pnpm audit` on Linux |

- **`ci` is the only required status check.** It runs after all other jobs and fails unless every one succeeded.
- Every step runs a `task` command, so a CI failure can be reproduced locally with the same command.
- Tools in CI: Go from `actions/setup-go` (`go-version-file: backend/go.mod`, i.e. the `toolchain` line) with `GOTOOLCHAIN=local`; Node.js from `actions/setup-node` (`.node-version`); pnpm via `npm install -g` with the exact `packageManager` value; Task 3.54.0 and golangci-lint 2.15.0 downloaded by `.github/scripts/install-tools.sh`, which checks each archive against a pinned SHA-256 and stops on a mismatch. govulncheck runs through `go run …@v1.9.0` (verified by the Go checksum database).
- Actions are GitHub-owned only (`actions/checkout` v7.0.1, `actions/setup-go` v7.0.0, `actions/setup-node` v7.1.0, `actions/cache` v6.1.0), pinned to full commit SHAs with the version in a comment.
- Workflow token: `contents: read`; `actions/checkout` does not keep credentials. No secrets are used.
- Caches: Go modules and build cache (setup-go, keyed on `backend/go.mod`); the pnpm store (`actions/cache`, keyed on OS and `frontend/package.json` + `pnpm-lock.yaml`).
- CI has no `backend/.env`; `Taskfile.yml` ignores the missing file and tests set their own variables.
- No path filters (they leave required checks pending). No deployment (staging deploy: PQ-054a).
- The `windows-2025` jobs catch breakage on the development OS, notably in Dependabot pull requests that are merged without a local run. Vulnerability scans, `compose.yaml` validation and the line-ending check are OS-independent and run on Linux only.

## Vulnerability scanning

- **Backend:** govulncheck v1.9.0 (`GOVULNCHECK_VERSION` in `Taskfile.yml`) reports vulnerabilities in modules and the Go standard library that the code can actually reach. A new Go security release therefore turns CI red until the toolchain is bumped.
- **Frontend:** `pnpm audit` over production **and** development dependencies; any severity fails.
- Accepted findings are listed in `frontend/pnpm-workspace.yaml` (`auditConfig.ignoreGhsas`) and here, each with a reason and a review date. Remove an entry as soon as a fixed version is available.

| Advisory | Package (path) | Severity | Why accepted | Review by |
| --- | --- | --- | --- | --- |
| GHSA-83rm-6c8r-g728 | `@intlify/shared` 10.0.8 (`@intlify/unplugin-vue-i18n` → `@intlify/vue-i18n-extensions`) | high | Build-time only; the app bundle uses `@intlify/shared` 11.4.16 (`pnpm audit --prod` is clean). No patched 10.x | 2026-12-07 [A] |
| GHSA-3g3m-2fjr-6pw4 | `glob` (`@vue/test-utils` → `js-beautify`) | moderate | Tests only; the fix needs glob 14 (major) under js-beautify | 2026-12-07 [A] |
| GHSA-g3hv-75wg-m249 | `minimatch` (ESLint) | moderate | Lint only, patterns come from our own configuration; the fix needs minimatch 11 (major) | 2026-12-07 [A] |

## Dependabot

`.github/dependabot.yml` proposes weekly updates (Mondays) with a 14-day cooldown, so proposed versions are at least two weeks old:

- `github-actions` — one grouped pull request (SHA and version comment);
- `npm` in `frontend/` — minor and patch updates grouped; **TypeScript ≥ 7 ignored** (vue-tsc does not support it yet, OD-10); `@types/node` ≥ 27 ignored (follows Node.js 26);
- `gomod` in `backend/` — inactive until PQ-005 adds modules;
- `docker-compose` — images in `compose.yaml`; PostgreSQL ≥ 19 ignored (major version is a decision, D-17). The first proposal must update the tag **and** the digest; if it does not, remove this entry.

Dependabot pull requests run the full CI, including the Windows jobs.

## Updating pinned tools

Dependabot does not update the toolchain. To bump a tool, change every place listed and run `task check`:

| Tool | Change |
| --- | --- |
| Go | `toolchain` in `backend/go.mod`; check that golangci-lint supports it |
| Node.js | `.node-version`, `engines.node` in `frontend/package.json` |
| pnpm | `packageManager` in `frontend/package.json` |
| Task | `REQUIRED_TASK_VERSION` in `Taskfile.yml`; `TASK_VERSION` and both SHA-256 values in `.github/scripts/install-tools.sh` |
| golangci-lint | `GOLANGCI_LINT_VERSION` in `Taskfile.yml`; version and both SHA-256 values in `.github/scripts/install-tools.sh` |
| govulncheck | `GOVULNCHECK_VERSION` in `Taskfile.yml` |

Take SHA-256 values from the release's official checksums file (exact file-name match). `task tools:verify` fails in CI if the versions drift apart.

## GitHub repository settings (owner)

Configured by the owner in the GitHub web interface (the repository is public):

1. **Ruleset for `main`** (Settings → Rules → Rulesets): target the default branch; require a pull request before merging; require status checks to pass — add `ci`, and require branches to be up to date; block force pushes; restrict deletions. Changes reach `main` only through pull requests.
2. **Actions** (Settings → Actions → General): allow only actions created by GitHub; require actions to be pinned to a full-length commit SHA; fork pull request workflows: require approval for all external contributors; workflow permissions: read repository contents; do not allow GitHub Actions to create or approve pull requests.
3. **Security** (Settings → Advanced Security): Dependabot alerts and Dependabot security updates on; secret scanning and push protection on.

Connect to the local database: `docker compose --env-file backend/.env exec postgres psql -U photoquest -d photoquest`.

Still to come, documented once implemented:

- Run migrations.
- Load seed data (location categories, equipment seed list, reserved handles; learning content for the extension).
- Generate API types from OpenAPI.
- Jobs CLI: list dead jobs, requeue a job.
- Staging: reset all staging data (database and bucket); create invite codes.
