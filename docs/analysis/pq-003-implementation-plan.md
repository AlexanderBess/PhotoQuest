# PQ-003 Local Development Environment — Implementation Plan

**Status:** approved by the owner on 2026-11-09 ("Да, начинай") and implemented the same day. Plan drafted 2026-11-08. Roles as in PQ-002: the implementing Claude Code session writes files and runs checks on the owner's Windows computer; the owner does all Git operations.

## 1. Baseline and prerequisites

| Item | State |
| --- | --- |
| Git baseline | `main` = `origin/main` = `0abc0f4` (PQ-002), clean working tree |
| Windows | Upgraded by the owner from Windows 10 21H1 (build 19043) to Windows 11 Pro 26H2 (build 26300). Docker Desktop 4.87.0 had refused to install on 19043 (requires 19045 / 22631) |
| Virtualization | Enabled in the BIOS/UEFI by the owner (was off) |
| WSL | 3.0.3, kernel 6.18.54.1 |
| Docker | Docker Desktop 4.98.0 (per-user, WSL 2 backend), Engine 29.9.2, Compose v5.6.1 |
| Pinned tools | Go 1.27.3, Node 26.13.0, pnpm 12.15.0, Task 3.54.0, golangci-lint 2.15.0 (session PATH only) |

## 2. Decisions

| ID | Topic | Decision |
| --- | --- | --- |
| OD-17 / D-17 | PostgreSQL version | **PostgreSQL 18**, image `postgres:18.6-trixie@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42`. PostgreSQL 19 was a release candidate (GA planned 2026-11-19) and hosting (D-11) is open. Debian (glibc) rather than Alpine (musl) for consistent collation behaviour |
| — | Local database setup | UTF-8, ICU locale provider, root collation `und` (language-neutral; Cyrillic sorts correctly). Superuser and database from `backend/.env`. No schemas, extensions or init scripts (migrations and schemas: PQ-005). No test database yet (added by the first task that needs one) |
| OD-13 | Local S3-compatible service | **Conflict:** PQ-003 requires a service in Compose; OD-13 defers the choice to PQ-007 after compatibility testing. **Resolution:** a **provisional** service in PQ-003, confirmed or replaced in PQ-007; OD-13 stays open. Provisional choice: SeaweedFS 4.52 (`chrislusf/seaweedfs:4.52@sha256:57877e32bb90073b37dc109b438ba66e84fd5ed9ced5f5c04f56444ef243ce59`, Apache 2.0, single-process `mini` mode). First alternative: Garage v2.5.0. MinIO community edition is not used (reported archived) |
| — | Image pinning | Exact tag plus digest |
| — | What runs in Compose | Only dependencies. API, worker and frontend run natively via the existing `task dev:*` commands; an application image comes later |

Candidates considered for local S3 (2026-11-08, from documentation and image metadata; real compatibility checks are PQ-007's job):

| Candidate | For | Against |
| --- | --- | --- |
| SeaweedFS 4.52 | Apache 2.0; one container; credentials and bucket from env vars; image includes `curl`; documented presigned URLs and POST policy | All-in-one process with many internal components; `Cache-Control` overrides and key disabling not confirmed |
| Garage v2.5.0 | Small; presigned URLs and PostObject implemented | `FROM scratch` image (no shell); needs a config file; overrides and key disabling not documented |
| RustFS 1.0.4 | Newly 1.0 | Not assessed in depth |
| pgsty/silo | MinIO fork | Community-maintained |

## 3. Implementation

| File | Change |
| --- | --- |
| `compose.yaml` (new) | Project `photoquest`; services `postgres` and `storage`; ports bound to `127.0.0.1` only (5432, 8333; SeaweedFS admin and internal ports not published); named volumes; required variables fail with a clear message |
| `backend/.env.example` (new) | Local-only placeholders: existing `PQ_*` process settings, Compose variables `PQ_DB_*` and `PQ_S3_*`, reserved `PQ_DATABASE_URL` (PQ-005) and `PQ_S3_ENDPOINT` (PQ-007) |
| `Taskfile.yml` | `dotenv: ["backend/.env"]` (shell variables take precedence); `deps:up` (`up -d --wait --wait-timeout 120`), `deps:down`, `deps:status`, `deps:logs`, `deps:reset` (prompt; `--volumes`); all `deps:*` stop with a message if `backend/.env` is missing |
| `docs/development/setup.md`, `README.md` | Docker prerequisites, local dependencies, configuration, commands |
| `TASKS.md`, `docs/analysis/risks-and-open-questions.md` | PQ-003 status, PQ-007 note, D-17 entry |

Health checks [A]: every 5 s, timeout 3 s, 12 retries, 20 s start period.

- `postgres`: `pg_isready -h 127.0.0.1`, over TCP, so it does not pass while the init-only server (Unix socket only) runs.
- `storage`: signed `HEAD` on the bucket with `curl --aws-sigv4`, which proves gateway, credentials and bucket together.

## 4. Verification (Windows 11, 2026-11-09)

| # | Check | Result |
| --- | --- | --- |
| 1 | Docker versions | Desktop 4.98.0, Engine 29.9.2, Compose v5.6.1, WSL 3.0.3; `hello-world` ran |
| 2 | Reserved port ranges (`netsh ... excludedportrange`) | 5432 and 8333 not excluded |
| 3 | Missing configuration | `task deps:up` without `backend/.env`: precondition message, exit 201. `docker compose config` without the env file: `required variable ... is missing a value` |
| 4 | `task deps:up` | Both services healthy in 7 s; running images match the pinned digests |
| 5 | PostgreSQL | `PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2)`; `UTF8`, provider `i`, locale `und`; data checksums on; data directory `/var/lib/postgresql/18/docker`; Russian sort `арбуз, Арка, еда, ёж, жук, яма` after Latin; no user schemas; extensions: `plpgsql` |
| 6 | Local S3 | Signed put 200, get 200 (body matches), delete 204, get after delete 404; anonymous get object / list bucket / list buckets 403; wrong secret 403; anonymous list from the host 403 |
| 7 | Exposure | Host listens on `127.0.0.1:5432` and `127.0.0.1:8333` only; connections from the LAN, WSL and VPN addresses refused |
| 8 | Failure visibility | Stopped `storage` shows as `Exited` in `task deps:status`; `task deps:up` brings it back healthy |
| 9 | Persistence and reset | Marker table and object survive `deps:down` / `deps:up`; non-interactive `deps:reset` refuses without `--yes`; `task --yes deps:reset` removes both volumes; after `deps:up` the markers are gone |
| 10 | Processes | `task dev:api`, `dev:worker`, `dev:web` start with dependencies running; `/healthz` returns `{"status":"ok"}` directly and through the Vite proxy; shell served with `lang="ru"`; worker logs `worker ready`. A shell-set `PQ_HTTP_ADDR` overrides `backend/.env` |
| 11 | Regression | `task test` (Go packages ok; 21 frontend tests pass), `task lint` (0 issues), `task build` pass |
| 12 | Repository | `backend/.env` ignored, `backend/.env.example` not ignored; new files LF |

Not covered: Linux behaviour (CI, PQ-004) and S3 provider compatibility (PQ-007).

## 5. Known limitations and follow-ups

- **SeaweedFS is provisional.** Unverified: `Cache-Control` overrides and whether disabling a key invalidates presigned URLs (PQ-007 checklist). It accepts SigV4 requests signed for any region.
- **Credentials in the container environment** are visible through `docker inspect`; acceptable for local-only placeholders, never for real secrets.
- **`dotenv` applies to every task**, including `task test`. Tests that read `PQ_*` variables must set them explicitly (`t.Setenv`), as `config_test.go` already does.
- **Reserved variables duplicate values** (`PQ_DATABASE_URL` repeats user, password, port and database name). PQ-005 may derive it instead.
- **Memory:** the Docker VM takes about 8 GB by default on this 16 GB machine; it can be limited in `%USERPROFILE%\.wslconfig`.
- **PostgreSQL update release** planned for 2026-11-12: bumping to the next 18.x patch needs a new tag and digest in `compose.yaml` and `setup.md`.
- Production must use PostgreSQL 18 with the same encoding and collation (D-11, PQ-054a/b).
