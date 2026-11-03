# Development Setup

This document will be completed as the toolchain is selected and implemented in slices S0–S1 (PQ-002 – PQ-007).

## Prerequisites

- Git
- Go 1.27.x. PQ-002 adds `backend/go.mod` with a `go 1.27` directive (minimum Go version required by the module) and a `toolchain` line naming the exact patch release; the `toolchain` line names the suggested toolchain for this main module; with the default `GOTOOLCHAIN=auto`, Go 1.21 or newer downloads and switches to it when the local toolchain is older. The CI Go version is pinned separately in PQ-004.
- Node.js 26 LTS (version pinned in `.node-version`, added in PQ-002)
- pnpm with a committed lockfile; the exact version is pinned in the `packageManager` field (added in PQ-002). Node 25+ no longer bundles Corepack, so pnpm is installed separately.
- Task (go-task) for root-level commands
- Docker and Docker Compose

## Expected local services

- PostgreSQL
- Local S3-compatible object storage (required for media development; chosen in PQ-003/PQ-007)

## Processes

- API process (`backend/cmd/api`)
- Worker process (`backend/cmd/worker`) — processes `platform.jobs` (media processing, file deletion, AI analysis)
- Frontend dev server (Vite)

## Environments

- **Local:** Docker Compose.
- **Staging** (from slice S1): invited testers only behind an access gate; public registration disabled; `noindex` headers, `robots.txt` disallow-all and meta tag; separate database, bucket, credentials and secrets; never shares data with production. Test-data and consent rules: `docs/analysis/implementation-roadmap.md`.
- **Production** (before the pilot gate): backups with tested restore, monitoring and alerts.

## Environment files

- `.env.example` at repository root or per application.
- No real credentials in the repository.
- Required configuration validated at startup.
- Safe local defaults documented (local storage endpoint, default UI locale `ru`).

## Required commands

The project should expose consistent root-level commands for:
- Start local dependencies.
- Run backend API.
- Run worker.
- Run frontend.
- Run migrations.
- Load seed data (location categories, equipment seed list, reserved handles; learning content for the extension).
- Generate API types from OpenAPI.
- Jobs CLI: list dead jobs, requeue a job.
- Staging: reset all staging data (database and bucket); create invite codes.
- Run tests.
- Run formatters/linters.

Exact commands are documented once implemented.
