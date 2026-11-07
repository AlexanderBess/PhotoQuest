# PQ-002 Project Skeleton — Implementation Proposal

> **Execution note (added when saving to the repository, 2026-11-07).**
> **Status: approved by the owner on 2026-11-03** ("PQ-002 approved"). Below this note is the approved Revision 5, exported unchanged from the review document (only the byline was removed). It was written when implementation was planned in a cloud session; implementation now runs in **Claude Code on the owner's Windows computer**. Read the plan with these updates:
>
> - **Preconditions are met.** Documentation baseline `785c904` and the separate clarifications commit `1e8d798` ("docs: apply PQ-002 preparation clarifications"); the working tree is clean before PQ-002. The "awaiting approval" line and the "not committed" row in section 0 are superseded.
> - **Roles.** "I" in the plan means the implementing Claude Code session; "you" means the owner. The session creates and edits files and runs commands locally; the owner does all Git operations (no commits, pushes, branches or pull requests by Claude).
> - **Checks.** There is no separate Linux workspace. The implementing session runs the checks from sections 7.1 and 7.2 on this Windows machine with the pinned tool versions and reports versions, commands and output; Linux-only items (SIGTERM, `sha256sum`) use Windows equivalents where they exist, and SIGTERM handling is verified in Linux CI (PQ-004). The owner then re-runs section 7.2 to confirm.
> - **Lockfile.** `pnpm-lock.yaml` is generated on Windows (section 8 assumed a Linux workspace).
> - Decisions, versions, project structure, dependencies, steps and acceptance criteria are otherwise unchanged.

**Revision 5 — awaiting your explicit approval.** This is a proposal only: no code, dependencies or project files are changed by it. PQ-002 delivers a Go API and worker (standard library only) with a root-level `/healthz`, plus a Russian, i18n-ready Vue shell with a build-time `noindex` flag.

## 0. Status and baseline

| Item | State |
| --- | --- |
| Documentation baseline | Commit `785c904` "docs: sync approved Revision 4 documentation" — `HEAD` of `main`, same commit as `origin/main`; 47 files, 3,759 insertions. Verified by you and by me. |
| 15 documentation clarifications | Applied in your **local working tree only** (9 modified files + `docs/analysis/documentation-update-2026-11-03-pq-002-prep.md`); **not committed and not pushed**. **Precondition for PQ-002:** you commit them as a separate documentation commit after `785c904`, before implementation starts, so the working tree is clean when step 1 begins. |
| PQ-002 implementation | Not started. Waits for your explicit approval of this revision. |

**Workflow.** I create and edit files directly in `C:\Users\2AB\WebstormProjects\PhotoQuest`. I do not clone, use GitHub, or create branches, commits or PRs; you do all Git operations. In this mode I cannot run commands on your computer, so I run the Linux checks on a copy of the files in my workspace, and you run the Windows checks (section 7.2).

**Revision history**

| Rev | Change |
| --- | --- |
| 1 | Initial proposal |
| 2 | Your decisions; corrections on Go JSON behaviour, Russian plural categories and TypeScript verification |
| 3 | Local-folder workflow; Go module path confirmed |
| 4 | Baseline status, PowerShell `noindex` commands, explicit `task dev:*` commands, `toolchain go1.27.3`, approved vs deferred decisions, worker idle loop, golangci-lint installation, separate Linux and Windows checks |
| 5 | `.gitignore` keeps `.env.example`; golangci-lint 2.15.0 (built with go1.27.0, verified); exact Node 26.13.0; clarifications committed separately as a precondition; PowerShell checksum check that fails on mismatch; explicit golangci-lint config path |

## 1. Decisions

The decisions PQ-002 needs are approved. Four technical decisions are **not** made yet; they are deferred to the tasks that need them, and PQ-002 does not depend on them.

### 1.1 Approved for PQ-002

| ID | Topic | Decision | Status |
| --- | --- | --- | --- |
| OD-1 | Documentation baseline | Revision 4 docs committed as `785c904` | Approved |
| OD-2 | Workflow | Files written directly into your local folder; you do all Git operations | Approved |
| OD-3 | Node.js | 26 LTS | Approved |
| OD-4 | Package manager | pnpm | Approved |
| OD-5 | Root commands | Task (`Taskfile.yml`) | Approved |
| OD-8 | Entry points | `cmd/api` + `cmd/worker` in one codebase and Docker image | Approved |
| OD-10 | TypeScript | 6.0, provided the exact TypeScript / vue-tsc / `@vue/language-core` / Vue combination passes type checking | Approved with conditions |
| OD-9 | Health endpoints | Root-level `/healthz` (`/readyz` in PQ-005) | Approved |
| OD-11 | `noindex` | Build-time flag `VITE_ROBOTS_NOINDEX` | Approved |
| OD-12 | Go module path | `github.com/AlexanderBess/PhotoQuest/backend` | Approved |
| OD-14 | Lint split | ESLint/golangci configs and local scripts in PQ-002; CI, i18n missing-key check and vulnerability scans in PQ-004 | Approved |
| OD-15 | Pinia, Playwright | Added at first use (PQ-010a; first E2E journey in S1) | Approved |
| OD-16 | Development OS | Native Windows; Linux checks in my workspace (later Linux CI) | Approved |

### 1.2 Deferred to their designated tasks (not decided)

| ID | Topic | Decided in | Status |
| --- | --- | --- | --- |
| OD-6 | Go router: chi vs standard library | PQ-005 | Deferred |
| OD-7 | Database access and migration tool | PQ-005 | Deferred |
| OD-13 | Local S3-compatible service | PQ-007, after compatibility testing | Deferred |
| OD-17 | PostgreSQL version and local database setup | PQ-003 | Deferred |

**Module path casing.** Go module and import paths are case-sensitive, so every import uses exactly `github.com/AlexanderBess/PhotoQuest/backend/...`. GitHub resolves names case-insensitively, but the Go tool rejects a fetch whose spelling differs from `go.mod`. The module cache escapes capitals with `!`, so Windows' case-insensitive file system is safe. The module is an application that nobody imports, so the practical impact is limited to our own imports and the `goimports` local prefix.

## 2. Toolchain

Current stable releases, except TypeScript, which stays on 6.0 because Vue's type checker cannot use TypeScript 7 yet. Frontend packages are pinned to exact versions at scaffold time and recorded in the report.

| Area | Version | Where it is pinned | Notes |
| --- | --- | --- | --- |
| Go | **1.27.3** | `backend/go.mod`: `go 1.27` + `toolchain go1.27.3` | `go 1.27` declares the minimum Go version the module requires. `toolchain go1.27.3` declares the suggested toolchain for working in this main module; it is not a minimum-toolchain requirement. With `GOTOOLCHAIN=auto` (the standard default), Go 1.21 or newer automatically downloads and switches to go1.27.3 when its bundled toolchain is older; Go releases before 1.21 have no automatic switching, and switching does not happen if `GOTOOLCHAIN` is set to `local`. CI pins its own Go version in PQ-004. `encoding/json` keeps v1 behaviour; the stricter defaults belong to the separate `encoding/json/v2` package. |
| Node.js | **26.13.0** (LTS) | `.node-version`: `26.13.0`; `engines.node` in `frontend/package.json`: `>=26.13.0 <27` | LTS since 2026-10-28, supported to April 2029. Node 25+ no longer bundles Corepack. |
| pnpm | Current stable, exact version | `packageManager` in `frontend/package.json`; `pnpm-lock.yaml` | Installed separately (no Corepack). |
| TypeScript | **6.0.x**, `strict` + `noUncheckedIndexedAccess` | `package.json` | Verified together with vue-tsc, `@vue/language-core` and Vue (OD-10). |
| Vue | **3.5.x** | `package.json` | 3.6 is a release candidate; Vapor mode is experimental. |
| Vite | **8.x** + `@vitejs/plugin-vue` | `package.json` | Rolldown-based. |
| Frontend lint / format | ESLint 10 (flat config) + `eslint-plugin-vue` + `typescript-eslint`; Prettier 3 | `package.json` | `vue/no-bare-strings-in-template` enabled. |
| Go lint / format | **golangci-lint 2.15.0** (built with go1.27.0, verified; section 2.1) | `Taskfile.yml` variable `GOLANGCI_LINT_VERSION`; `backend/.golangci.yml` (`version: "2"`), passed with `--config` from `backend/` | Runs `gofmt`, `goimports`, `govet`, `staticcheck`, `errcheck`, `gosec`, `errorlint`, `bodyclose`, `noctx`. |
| Task | go-task v3 | README / `setup.md` | Root commands `task dev:api`, `task dev:worker`, `task dev:web`, `task test`, `task lint`, `task fmt`, `task build`. |
| Docker Desktop | — | — | Not needed for PQ-002 (from PQ-003). |

### 2.1 golangci-lint: installation and verification

The linter is a standalone binary, not a project dependency. Pinned version: **2.15.0** (official release, 16 October 2026), stored once in `Taskfile.yml` as `GOLANGCI_LINT_VERSION`.

**Verified on 2026-11-03 in my workspace (scratch folder, deleted afterwards):**

- The official `golangci-lint-2.15.0-linux-amd64.tar.gz` and `golangci-lint-2.15.0-windows-amd64.zip` both match the official checksums file (`sha256sum -c`: OK).
- The Linux binary reports: `golangci-lint has version 2.15.0 built with go1.27.0 from 25c5369a on 2026-10-16T11:03:09Z`.
- `go version` on the embedded build info reports `go1.27.0` for both the Linux binary and the Windows `golangci-lint.exe`. The Windows binary itself is executed only by you (check 7.2-1).

Official SHA-256 values (from `golangci-lint-2.15.0-checksums.txt`):

| File | SHA-256 |
| --- | --- |
| `golangci-lint-2.15.0-windows-amd64.zip` | `cd7ea6063c95de245e17e5246e42bdc14bb221792c429dbd239ab3a6ade6ca6a` |
| `golangci-lint-2.15.0-linux-amd64.tar.gz` | `9b7fe6a6bf6334b98decf8d86b11415ea7889afdabdd1959fdce23af2a9ebcea` |

The checksums file also lists `.sbom.json` entries for each archive, so the lookup must match the exact file name, not a substring.

**Windows installation (you, PowerShell).** The script stops with an error if the checksum entry is missing or ambiguous, if it differs from the pinned value, or if the downloaded archive's SHA-256 differs:

```powershell
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12   # needed only in Windows PowerShell 5.1
$v      = "2.15.0"
$file   = "golangci-lint-$v-windows-amd64.zip"
$pinned = "cd7ea6063c95de245e17e5246e42bdc14bb221792c429dbd239ab3a6ade6ca6a"
$base   = "https://github.com/golangci/golangci-lint/releases/download/v$v"
$dir    = Join-Path $env:TEMP "golangci-lint-$v"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest "$base/$file" -OutFile (Join-Path $dir $file) -UseBasicParsing
Invoke-WebRequest "$base/golangci-lint-$v-checksums.txt" -OutFile (Join-Path $dir "checksums.txt") -UseBasicParsing

# exact file-name match (excludes the .sbom.json entry)
$entries = @(Get-Content (Join-Path $dir "checksums.txt") | Where-Object { ($_ -split '\s+')[1] -eq $file })
if ($entries.Count -ne 1) { throw "Expected exactly one checksum entry for $file, found $($entries.Count)" }
$expected = ($entries[0] -split '\s+')[0].ToLowerInvariant()
if ($expected -ne $pinned) { throw "Official checksum $expected differs from the pinned value $pinned" }
$actual = (Get-FileHash (Join-Path $dir $file) -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "SHA-256 mismatch for ${file}: expected $expected, got $actual" }
Write-Host "SHA-256 OK: $actual"

Expand-Archive (Join-Path $dir $file) -DestinationPath "$env:USERPROFILE\tools" -Force
$bin = "$env:USERPROFILE\tools\golangci-lint-$v-windows-amd64"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (($userPath -split ';') -notcontains $bin) { [Environment]::SetEnvironmentVariable("Path", "$userPath;$bin", "User") }
# open a new terminal, then:
golangci-lint version
# expect: golangci-lint has version 2.15.0 built with go1.27.0 ...
```

**Linux (my workspace):** the same release, with an anchored match:

```bash
grep -E '  golangci-lint-2\.15\.0-linux-amd64\.tar\.gz$' golangci-lint-2.15.0-checksums.txt | sha256sum -c -
```

**Configuration path.** `backend/.golangci.yml` sits next to `backend/go.mod`, the Go module root; golangci-lint must run from there. In `Taskfile.yml`, the `lint:go` and `fmt:go` tasks set `dir: backend` and pass the configuration explicitly:

```text
golangci-lint config verify --config .golangci.yml
golangci-lint run --config .golangci.yml ./...
golangci-lint fmt --config .golangci.yml
```

**Verification (both platforms):**

- `golangci-lint version` reports `2.15.0 built with go1.27.0`.
- `task lint` first compares `golangci-lint version` with `GOLANGCI_LINT_VERSION` and stops with a clear message on a mismatch, so a wrong local version cannot pass silently.
- `golangci-lint config verify --config .golangci.yml` (in `backend/`) validates the configuration.

Upstream recommends the binary installation and does not guarantee `go install` builds, so `go install` is not part of this procedure.

## 3. Project structure

PQ-002 creates only what it uses. No empty module, slice or layer folders (ADR-010, CLAUDE.md §4).

```text
PhotoQuest/
├── .editorconfig            # UTF-8, LF; 2 spaces (TS/Vue/YAML), tabs (Go)
├── .gitattributes           # * text=auto eol=lf
├── .gitignore               # build output, node_modules, .idea/, coverage; .env and .env.* ignored, .env.example kept
├── .node-version            # 26.13.0 (exact LTS patch)
├── Taskfile.yml             # dev:api, dev:worker, dev:web, test, lint, fmt, build; GOLANGCI_LINT_VERSION
├── README.md                # + "Local startup" section
├── CLAUDE.md, TASKS.md, docs/
├── backend/
│   ├── go.mod               # see below
│   ├── .golangci.yml        # version: "2"
│   ├── cmd/
│   │   ├── api/main.go      # thin: config, logger, app.RunAPI, exit code
│   │   └── worker/main.go   # thin: config, logger, app.RunWorker, exit code
│   └── internal/
│       ├── app/
│       │   ├── api.go       # HTTP server, routes, graceful shutdown
│       │   ├── worker.go    # idle worker (section 6, step 4)
│       │   └── *_test.go
│       └── platform/
│           ├── config/      # minimal env reading (validation in PQ-005)
│           ├── logger/      # slog setup (redaction in PQ-005)
│           └── observability/
│               ├── health.go       # GET /healthz
│               └── health_test.go
└── frontend/
    ├── package.json         # packageManager, engines, scripts
    ├── pnpm-lock.yaml, .npmrc
    ├── index.html           # <html lang="ru">
    ├── vite.config.ts       # plugin-vue, i18n precompile, dev proxy, noindex transform, Vitest
    ├── tsconfig.json (+ .app / .node / .vitest)
    ├── eslint.config.ts, .prettierrc.json
    ├── .env.example         # VITE_ROBOTS_NOINDEX=false
    └── src/
        ├── app/       main.ts, App.vue, router/index.ts, providers/i18n.ts, styles/base.css
        ├── pages/     home/HomePage.vue, not-found/NotFoundPage.vue
        └── shared/
            ├── config/env.ts
            └── i18n/      plural.ts, plural.spec.ts, locales/ru/common.json
```

**`backend/go.mod`** (no `require` block in PQ-002):

```text
module github.com/AlexanderBess/PhotoQuest/backend

go 1.27

toolchain go1.27.3
```

Conventions:

- `cmd/*` mains stay thin. `modules/`, `shared/shootingdetails`, `migrations/`, `openapi/` and `seeds/` are created by the tasks that first need them (PQ-005 onward).
- Frontend: only `app/`, `pages/` and `shared/` exist in PQ-002. Tests sit next to the code as `*.spec.ts`.
- Locales live in `shared/i18n/locales/<locale>/<area>.json`; PQ-002 creates `ru/common.json`. The shared language switcher arrives with the second locale; adding a language means adding and registering its locale folder.

**`.gitignore` environment rules.** Patterns without a slash apply in every directory, so the same three lines cover `frontend/` and, later, `backend/`:

```text
.env
.env.*
!.env.example
```

Result: `frontend/.env.example` is committed; `.env`, `.env.local`, `.env.production`, `.env.staging.local` and similar files stay ignored. Checked in 7.1 and 7.2-8.

## 4. Dependencies

The backend has **no third-party Go modules** in PQ-002 (standard library `net/http`, `log/slog`, `os/signal`). The frontend adds three runtime packages.

| Package | Kind | Why |
| --- | --- | --- |
| `vue` 3.5 | runtime | Framework (ADR-010) |
| `vue-router` 5 | runtime | Routing; v5 has no breaking changes from v4; manual routes, no file-based routing |
| `vue-i18n` 11 | runtime | Composition API mode (ADR-024) |
| `vite`, `@vitejs/plugin-vue` | dev | Dev server and build |
| `@intlify/unplugin-vue-i18n` | dev | Precompiles locale messages, so the runtime needs no message compiler (strict CSP, PQ-054b) |
| `typescript` 6.0, `vue-tsc`, `@vue/tsconfig`, `@types/node` | dev | Strict type checking of `.ts` and `.vue` |
| `vitest`, `@vue/test-utils`, `jsdom` | dev | Unit and component tests |
| `eslint`, `eslint-plugin-vue`, `typescript-eslint`, `@vue/eslint-config-typescript`, `@vue/eslint-config-prettier`, `prettier` | dev | Linting and formatting |

Not added in PQ-002: `pinia` (PQ-010a), `@playwright/test` (first E2E journey in S1), Go router, database and migration libraries (PQ-005), vulnerability scanners (PQ-004). Not proposed at all: web frameworks, ORMs, config libraries, UI kits, CSS frameworks, axios, date libraries, queue libraries.

## 5. Development environment

PQ-002 needs Go, Node, pnpm, Task and golangci-lint only — no database or containers. Docker Compose, PostgreSQL and local S3 belong to PQ-003 and PQ-007.

**Local startup (Windows, three terminals from the repository root):**

```powershell
task dev:api      # API on http://127.0.0.1:8080
task dev:worker   # worker process
task dev:web      # Vite dev server on http://localhost:5173, proxies /api and /healthz to the API
```

One-time setup: `git config core.autocrlf false` in this repository (LF is enforced by `.gitattributes`), then `cd frontend; pnpm install --frozen-lockfile`.

**Single origin.** The browser talks to one origin: the Vite proxy locally, a reverse proxy on staging and production. No CORS.

| Variable | Process | Default | Purpose |
| --- | --- | --- | --- |
| `PQ_ENV` | api, worker | `local` | `local` / `staging` / `production`; text logs locally, JSON elsewhere |
| `PQ_HTTP_ADDR` | api | `127.0.0.1:8080` | Listen address (`0.0.0.0:8080` inside containers later) |
| `PQ_LOG_LEVEL` | api, worker | `info` | `debug` / `info` / `warn` / `error` |
| `PQ_SHUTDOWN_TIMEOUT` | api, worker | `10s` \[A\] | Graceful-shutdown limit |
| `VITE_ROBOTS_NOINDEX` | frontend build | `false` | `true` puts `<meta name="robots" content="noindex, nofollow">` into the built `index.html` |

`vite.config.ts` reads `VITE_ROBOTS_NOINDEX` through Vite's `loadEnv`, so it can come from the shell or from a `.env` file; a variable set in the shell takes precedence. No secrets in `VITE_*` variables. `.env` files are git-ignored; `frontend/.env.example` is committed in PQ-002, `backend/.env.example` in PQ-003. Validated configuration that fails fast arrives in PQ-005.

## 6. Implementation steps

I write each step's files into your folder and list them; you review and commit whenever you choose. I never run Git.

| # | Change | Expected result |
| --- | --- | --- |
| 0 | Precondition (you): the 15 documentation clarifications are committed as a separate commit after `785c904`; `git status --short` is empty | Clean working tree; PQ-002 changes are the only ones you review afterwards |
| 1 | Repo hygiene: `.gitattributes`, `.editorconfig`, `.gitignore` (with `!.env.example`), `.node-version` (`26.13.0`) | No CRLF diffs on Windows |
| 2 | `backend/go.mod` (module path, `go 1.27`, `toolchain go1.27.3`); `platform/config`, `platform/logger`, `platform/observability/health.go` | `go build ./...` succeeds with no third-party modules |
| 3 | `cmd/api` + `app/api.go`: HTTP server with read-header, read, write and idle timeouts; `GET /healthz`; graceful shutdown | `200 {"status":"ok"}`; clean exit on Ctrl+C within `PQ_SHUTDOWN_TIMEOUT` |
| 4 | `cmd/worker` + `app/worker.go`: starts, logs readiness, then **blocks on `<-ctx.Done()`** of a context from `signal.NotifyContext` (Ctrl+C on Windows; SIGINT/SIGTERM on Linux). No loop, no polling, no sleep, so \~0% CPU while idle. PQ-006 replaces this with a `time.Ticker`-based poll (\~1 s, ADR-022) selected together with `ctx.Done()` | Starts, idles without CPU use, exits cleanly on Ctrl+C |
| 5 | Backend tests + `.golangci.yml`: health handler (status, content type, body, `405` on non-GET); API shutdown; worker returns promptly after cancellation | `go test ./...`, `go vet ./...`, `golangci-lint run` pass |
| 6 | Frontend scaffold by hand: `package.json`, Vite, tsconfig, ESLint, Prettier; lockfile generated | `pnpm-lock.yaml` written; exact versions recorded |
| 7 | Shell: `app/` (entry, `App.vue`, router with home + catch-all), `pages/home`, `pages/not-found`, `shared/config` | Russian shell at `/`; Russian not-found page for unknown routes |
| 8 | i18n: Vue I18n Composition mode, `ru` default + fallback, `locales/ru/common.json`, CLDR plural rule via `Intl.PluralRules('ru')` (one / few / many / other), precompiled messages; missing keys throw in dev and tests | No literal UI text in templates; `<html lang="ru">` |
| 9 | `noindex`: `transformIndexHtml` hook injects the robots meta into the built HTML when `VITE_ROBOTS_NOINDEX=true` | Meta present only in flagged builds |
| 10 | Frontend tests and scripts (`dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `format:check`, `test`) | All pass |
| 11 | `Taskfile.yml`: `task dev:api`, `task dev:worker`, `task dev:web`, `task test`, `task lint`, `task fmt`, `task build`. `lint:go` and `fmt:go` run with `dir: backend` and `--config .golangci.yml`; `task lint` checks the golangci-lint version first. Vite proxy for `/api` and `/healthz` | Commands work from PowerShell |
| 12 | Docs: README "Local startup"; `setup.md` exact versions and commands; D-17 entry; TASKS PQ-002 status | Docs match what was built |
| 13 | Linux checks (7.1) and final report: changed files, exact versions, commands and results, known limitations | Report delivered; you run the Windows checks (7.2) |

## 7. Acceptance criteria

PQ-002 is complete when every check below has actually been run and passes. I run 7.1 on Linux and report the command output; you run 7.2 on Windows. A Linux pass does not replace a Windows check.

### 7.1 Linux checks (I run these in my workspace)

- [ ] Exact tool versions recorded: `go version` (go1.27.3), `node --version` (v26.13.0), `pnpm --version`, `golangci-lint version` (2.15.0, built with go1.27.0).
- [ ] Backend: `gofmt -l .` prints nothing; `go build ./...`, `go vet ./...`, `go test ./...`, `golangci-lint config verify --config .golangci.yml` and `golangci-lint run --config .golangci.yml ./...` (both from `backend/`) pass; `go.mod` has no `require` block.
- [ ] API smoke test: `curl -i http://127.0.0.1:8080/healthz` → `200`, `Content-Type: application/json`, `{"status":"ok"}`; `curl -X POST` → `405`; SIGINT and SIGTERM → exit code 0 within the timeout.
- [ ] Worker: starts, logs readiness, CPU time does not grow over 10 s of idling, exits with code 0 on SIGINT/SIGTERM.
- [ ] Frontend: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` pass.
- [ ] TypeScript combination (OD-10): exact `typescript`, `vue-tsc`, `@vue/language-core` and `vue` versions listed; `pnpm typecheck` output with zero errors included in the report.
- [ ] i18n tests: Russian plurals — 1/21/101 → "фотография", 2/4/22 → "фотографии", 0/5/11/12/14/25/111 → "фотографий", 1.5 (CLDR `other`) → "фотографии"; a missing key fails the test run; the shell renders text from `ru` messages.
- [ ] `noindex`: `VITE_ROBOTS_NOINDEX=true pnpm build` → `dist/index.html` contains `<meta name="robots" content="noindex, nofollow">`; a default build does not.
- [ ] All new text files are UTF-8, LF, with a final newline. In a temporary Git repository with the new `.gitignore`: `git check-ignore frontend/.env.example` prints nothing, while `frontend/.env`, `frontend/.env.local` and `frontend/.env.production` are reported as ignored.

### 7.2 Windows checks (you run these in PowerShell)

Use `curl.exe`, not `curl`: in Windows PowerShell 5.1, `curl` is an alias for `Invoke-WebRequest`.

**1. Tools**

```powershell
go version              # go1.27.3 windows/amd64 (Go 1.21+ with GOTOOLCHAIN=auto switches to go1.27.3 automatically if the local toolchain is older)
node --version          # v26.13.0
pnpm --version          # equals packageManager in frontend\package.json
task --version
golangci-lint version   # golangci-lint has version 2.15.0 built with go1.27.0 ...
```

**2. Backend**

```powershell
cd C:\Users\2AB\WebstormProjects\PhotoQuest\backend
go build ./...
go vet ./...
go test ./...
golangci-lint config verify --config .golangci.yml
golangci-lint run --config .golangci.yml ./...
cd ..
task lint    # from the repository root; runs the same golangci-lint commands in backend/ plus the frontend lint
```

**3. API** — terminal 1: `task dev:api`; terminal 2:

```powershell
curl.exe -i http://127.0.0.1:8080/healthz
# expect: HTTP/1.1 200 OK, Content-Type: application/json, {"status":"ok"}
curl.exe -s -o NUL -w "%{http_code}`n" -X POST http://127.0.0.1:8080/healthz
# expect: 405
```

Then press Ctrl+C in terminal 1: the API logs a shutdown message and the prompt returns within 10 s.

**4. Worker** — terminal 1: `task dev:worker`; terminal 2:

```powershell
(Get-Process worker).CPU; Start-Sleep -Seconds 10; (Get-Process worker).CPU
# expect: the two values are equal or differ by a negligible amount
```

Then press Ctrl+C in terminal 1: the worker logs a shutdown message and exits.

**5. Frontend**

```powershell
cd C:\Users\2AB\WebstormProjects\PhotoQuest\frontend
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

**6. Shell in the browser** — with `task dev:api` and `task dev:web` running:

- `http://localhost:5173/` shows the Russian shell; `http://localhost:5173/no-such-page` shows the Russian not-found page.
- `curl.exe -s http://localhost:5173/healthz` returns `{"status":"ok"}` through the Vite proxy.

**7. `noindex` flag** (in `frontend`):

```powershell
$env:VITE_ROBOTS_NOINDEX = "true"
pnpm build
Select-String -Path dist\index.html -Pattern 'content="noindex, nofollow"'
# expect: one matching line
Remove-Item Env:VITE_ROBOTS_NOINDEX
pnpm build
Select-String -Path dist\index.html -Pattern 'name="robots"'
# expect: no output
```

`$env:` sets the variable for the current PowerShell session only; `Remove-Item Env:` removes it. Make sure no `frontend\.env*` file sets it to `true`.

**8. Git state, `.gitignore` and line endings**

Before step 1 (precondition):

```powershell
cd C:\Users\2AB\WebstormProjects\PhotoQuest
git log --oneline -2
# expect: your documentation-clarifications commit on top of 785c904
git status --short
# expect: no output
```

After PQ-002 is written into the folder, before you commit it:

```powershell
git status --short
# expect: only PQ-002 files (new .gitattributes, .editorconfig, .gitignore, .node-version, Taskfile.yml,
# backend/, frontend/; modified README.md, TASKS.md, docs/development/setup.md, D-17 entry)
git check-ignore -v frontend/.env.example
# expect: no output (the file is not ignored)
New-Item frontend\.env.local -ItemType File | Out-Null
git check-ignore -v frontend/.env.local
# expect: a line naming the .gitignore rule
Remove-Item frontend\.env.local
```

After you commit PQ-002:

```powershell
git status --short
# expect: no output
git ls-files --eol | Select-String "w/crlf"
# expect: no output
```

### 7.3 Scope and documentation

- [ ] No product-domain code: no `modules/`, migrations, database access, OpenAPI endpoints or domain UI.
- [ ] No `.env` file created; `frontend/.env.example` without secrets.
- [ ] README "Local startup" and `setup.md` list the exact versions and commands; TASKS.md PQ-002 status updated in the working tree for you to commit.
- [ ] Final report lists every changed file, the exact versions, each command with its result, and known limitations.

## 8. Assumptions and potential issues

**Assumptions**

- **\[A\] Dev runs use `go run`.** `task dev:api` and `task dev:worker` run `go run ./cmd/api` and `go run ./cmd/worker`, so the processes are named `api` and `worker` (used in check 7.2-4).
- **\[A\] Shutdown timeout 10 s** and the HTTP server timeouts are defaults, documented per CLAUDE.md's \[A\] rule.
- **\[A\] Separate frontend builds per environment** (build-time `noindex`); production must be built without the flag (checked in PQ-054b).
- **\[A\] Lockfile portability.** `pnpm-lock.yaml` is generated in my Linux workspace; pnpm records platform-specific optional packages for all platforms, and Windows check 7.2-5 (`--frozen-lockfile`) confirms it.
- **\[A\] Exact patch versions** of frontend packages are resolved at scaffold time (each at least two weeks old) and listed in the report. Go 1.27.3, Node 26.13.0 and golangci-lint 2.15.0 are fixed in this proposal.

**Potential issues**

- **Linux checks cannot replace Windows checks:** path separators, line endings and signal handling differ; section 7.2 covers these on your machine.
- **TypeScript 7:** an automatic upgrade to 7.x would break `.vue` type checking until Volar supports it; Dependabot (PQ-004) needs an ignore rule.
- **golangci-lint and Go versions move together:** 2.15.0 is built with go1.27.0 (verified). A future Go minor release needs a golangci-lint built with it; the version check in `task lint` makes a mismatch visible.
- **Clarifications precondition:** PQ-002 starts only after you commit the 15 documentation clarifications separately (step 0); step 12 then edits `setup.md` and the D-17 entry on top of that commit.
- **Hosting (D-11)** is needed in S1 and may constrain later choices (PostgreSQL, S3 provider); it does not affect PQ-002.

## Sources

Version and status checks, 2026-11-03:

- [Go release history](https://go.dev/doc/devel/release) — go1.27.3, 2026-10-19
- [Go 1.27 release notes](https://go.dev/doc/go1.27) — `encoding/json` keeps v1 behaviour; stricter defaults in `encoding/json/v2`
- [Node.js 26 "Lithium" reaches LTS](https://www.linuxcompatible.org/story/nodejs-26130-lithium-reaches-lts-support-through-april-2029/) — 26.13.0
- [golangci-lint release v2.15.0](https://github.com/golangci/golangci-lint/releases/tag/v2.15.0) — 16 October 2026; build Go version and checksums verified by running the binaries
- [golangci-lint local installation](https://golangci-lint.run/docs/welcome/install/local/) — binary installation recommended; `go install` not guaranteed
- [Announcing Vite 8](https://vite.dev/blog/announcing-vite8)
- [TypeScript 7 released (InfoQ)](https://infoq.com/news/2026/08/typescript-7-released/) and [TypeScript 7.1 and framework tooling](https://byteiota.com/typescript-71-beta-stable-api-vue-svelte-astro/)
- [Vue 3.6 release candidates](https://www.besthub.dev/articles/two-rcs-in-one-week-90-vapor-focused-is-vue-gearing-up-for-a-major-shift-588174d0e4be)
- [Vue Router 5 (InfoQ)](https://infoq.com/news/2026/03/vue-router-5)
- [vue-i18n overview](https://www.locize.com/i18n-libraries/vue-i18n)
- [ESLint 10 release (InfoQ)](https://infoq.com/news/2026/04/eslint-10-release)
- [pnpm releases](https://releases.sh/pnpm)
