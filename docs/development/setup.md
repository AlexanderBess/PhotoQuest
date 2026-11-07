# Development Setup

This document will be completed as the toolchain is selected and implemented in slices S0–S1 (PQ-002 – PQ-007). Commands below exist today unless marked otherwise.

## Prerequisites

| Tool | Version | Where it is pinned | Install on Windows |
| --- | --- | --- | --- |
| Git | any recent | — | https://git-scm.com/ |
| Go | 1.27.3 | `backend/go.mod` (`go 1.27`, `toolchain go1.27.3`) | https://go.dev/dl/ |
| Node.js | 26.13.0 (LTS) | `.node-version`; `engines.node` in `frontend/package.json` (`>=26.13.0 <27`) | `nvm install 26.13.0`, `nvm use 26.13.0`, or https://nodejs.org/dist/v26.13.0/ |
| pnpm | 12.15.0 | `packageManager` in `frontend/package.json` | `npm install -g pnpm@12.15.0` |
| Task (go-task) | 3.54.0 or newer v3 | — | https://github.com/go-task/task/releases |
| golangci-lint | 2.15.0 (built with go1.27.0) | `GOLANGCI_LINT_VERSION` in `Taskfile.yml` | Official binary with the checksum-verifying script in `docs/analysis/pq-002-implementation-plan.md`, section 2.1; `go install` is not supported upstream |

- The `go` directive is the minimum Go version the module requires; the `toolchain` line names the suggested toolchain for this main module. With the default `GOTOOLCHAIN=auto`, Go 1.21 or newer downloads and switches to it when the local toolchain is older. The CI Go version is pinned separately in PQ-004.
- Node 25+ no longer bundles Corepack, so pnpm is installed separately. pnpm refuses to install on a Node version outside `engines.node` (`engineStrict`).
- `task lint` compares `golangci-lint version` with `GOLANGCI_LINT_VERSION` first and stops on a mismatch.
- Docker and Docker Compose are needed from PQ-003; PQ-002 does not use them.

## One-time setup

From the repository root:

```powershell
git config core.autocrlf false
cd frontend
pnpm install --frozen-lockfile
```

`.gitattributes` enforces LF in the repository (`* text=auto eol=lf`).

pnpm 11 and newer read their settings from `frontend/pnpm-workspace.yaml`, not from `.npmrc`. `allowBuilds` lists packages with install scripts: pnpm fails an install if one is not listed, and `esbuild` is denied because it runs from its prebuilt platform package.

## Expected local services

- PostgreSQL (from PQ-003)
- Local S3-compatible object storage (required for media development; chosen in PQ-003/PQ-007)

## Processes

Run each in its own terminal, from the repository root. Ctrl+C stops a process gracefully.

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

- HTTP server timeouts [A], in `backend/internal/app/api.go`: read header 5 s, read 15 s, write 30 s, idle 60 s.
- `vite.config.ts` reads `VITE_ROBOTS_NOINDEX` through Vite's `loadEnv`, so it can come from the shell or from a `.env` file; a variable set in the shell takes precedence. Staging and production are separate builds; production must be built without the flag (checked in PQ-054b).
- Validated configuration that fails fast arrives in PQ-005.

## Environments

- **Local:** Docker Compose (from PQ-003).
- **Staging** (from slice S1): invited testers only behind an access gate; public registration disabled; `noindex` headers, `robots.txt` disallow-all and meta tag; separate database, bucket, credentials and secrets; never shares data with production. Test-data and consent rules: `docs/analysis/implementation-roadmap.md`.
- **Production** (before the pilot gate): backups with tested restore, monitoring and alerts.

## Environment files

- `frontend/.env.example` is committed; `backend/.env.example` follows in PQ-003. `.env` and `.env.*` are git-ignored.
- No real credentials in the repository, and no secrets in `VITE_*` variables.
- Required configuration validated at startup (from PQ-005).
- Safe local defaults documented (local storage endpoint, default UI locale `ru`).

## Commands

Available from the repository root:

| Command | What it does |
| --- | --- |
| `task dev:api`, `task dev:worker`, `task dev:web` | Run a process |
| `task test` | `go test ./...` and `pnpm test` |
| `task lint` | golangci-lint version check, `golangci-lint config verify` and `run` (in `backend/`), `pnpm lint`. `config verify` downloads its schema, so it needs network access |
| `task fmt` | `golangci-lint fmt` and `pnpm format` |
| `task build` | Backend binaries in `backend/bin/` and the frontend bundle in `frontend/dist/` |

Available from `frontend/`: `pnpm dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `format:check`, `test`.

Still to come, documented once implemented:

- Start local dependencies.
- Run migrations.
- Load seed data (location categories, equipment seed list, reserved handles; learning content for the extension).
- Generate API types from OpenAPI.
- Jobs CLI: list dead jobs, requeue a job.
- Staging: reset all staging data (database and bucket); create invite codes.
