# PQ-004 Quality Gates — Implementation Plan

**Status:** approved by the owner on 2026-11-09 and implemented the same day; waiting for the first GitHub Actions run (section 6). Roles as in PQ-002 and PQ-003: the implementing Claude Code session writes files and runs checks on the owner's Windows computer; the owner does all Git operations.

## 1. Baseline

| Item | State |
| --- | --- |
| Git | `main` = `origin/main` = `2634e58` (PQ-003), clean working tree |
| Repository | `github.com/AlexanderBess/PhotoQuest`, made **public** by the owner on 2026-11-09 (branch rulesets and Actions minutes are free) |
| `gh` CLI | Not installed; not needed for this task |
| Pinned tools | Go 1.27.3, Node 26.13.0, pnpm 12.15.0, Task 3.54.0, golangci-lint 2.15.0 (session PATH only) |
| Probes before planning | `govulncheck@v1.9.0`: no vulnerabilities. `pnpm audit`: 3 advisories, all in dev dependencies (`--prod` clean) |

## 2. Decisions

| # | Question | Decision |
| --- | --- | --- |
| Q1 | GitHub plan, branch flow | Repository public; changes reach `main` only through pull requests with the required check `ci` |
| Q2 | Runner OS | **Linux and Windows** (`ubuntu-24.04`, `windows-2025`) for the backend and frontend jobs; OS-independent jobs on Linux only |
| Q3 | Compose in CI | Validate `compose.yaml` only; starting services belongs to the first task that needs a database (PQ-005) |
| Q4 | Existing audit findings | Accept the three dev-only advisories with a reason and review date (2026-12-07 [A]); fail on any other finding of any severity |
| Q5 | Task version | Exactly 3.54.0, checked by `tools:verify` |
| Q6 | Linux image | `ubuntu-24.04` (named explicitly, not `ubuntu-latest`) |
| Q7 | Dependabot for `compose.yaml` | Yes, provided the first proposal updates tag and digest together; otherwise remove the entry |
| D-17 | Vulnerability scanners | govulncheck v1.9.0 (official, reachability-aware, covers the standard library) and `pnpm audit` (built into pnpm, no new tool). Alternative considered: OSV-Scanner v2.7.0 |
| — | i18n check | Own script (`frontend/scripts/check-i18n.ts`, Node 26 runs TypeScript directly), no new dependency. `@intlify/eslint-plugin-vue-i18n` 4.5.1 supports ESLint 10 but expects namespaces inside the JSON, while our file name is the namespace |
| — | Third-party code in CI | GitHub-owned actions only, pinned by commit SHA. Task and golangci-lint come from their GitHub releases, checked against pinned SHA-256 values. pnpm via `npm install -g` with the exact `packageManager` value. Not used: `pnpm/action-setup` (v6.1.1 was 6 days old), `go-task/setup-task`, `golangci-lint-action` |

### Pinned versions

| Item | Version | Pin |
| --- | --- | --- |
| `actions/checkout` | v7.0.1 (2026-07-20) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-go` | v7.0.0 (2026-07-16) | `b7ad1dad31e06c5925ef5d2fc7ad053ef454303e` |
| `actions/setup-node` | v7.1.0 (2026-10-08) | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/cache` | v6.1.0 (2026-06-26) | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
| Task 3.54.0 | `task_linux_amd64.tar.gz` | SHA-256 `680859dbb4d881a9c72d4d9a8f510825450849af8567deacd7302c01124416fb` |
| Task 3.54.0 | `task_windows_amd64.zip` | SHA-256 `837f42f71899ea41d07a47acc81d4d6ea80cb41c68292345f915c656473efcb7` |
| golangci-lint 2.15.0 | `…-linux-amd64.tar.gz` | SHA-256 `9b7fe6a6bf6334b98decf8d86b11415ea7889afdabdd1959fdce23af2a9ebcea` |
| golangci-lint 2.15.0 | `…-windows-amd64.zip` | SHA-256 `cd7ea6063c95de245e17e5246e42bdc14bb221792c429dbd239ab3a6ade6ca6a` |
| govulncheck | v1.9.0 (2026-10-11) | `go run …@v1.9.0`, Go checksum database |

## 3. Implementation

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` (new) | Triggers: PRs to `main`, pushes to `main`, manual. Jobs `backend` and `frontend` (matrix `ubuntu-24.04`, `windows-2025`, `fail-fast: false`), `vulnerabilities` (reusable workflow), `repository` (Linux), `ci` (needs all, `if: always()`, fails unless every job succeeded). `contents: read`, `persist-credentials: false`, `GOTOOLCHAIN=local`, PR runs cancel superseded runs, job timeouts, no path filters |
| `.github/workflows/vulnerabilities.yml` (new) | govulncheck and `pnpm audit` on Linux; called by `ci.yml`, weekly on Mondays 03:00 UTC, manual |
| `.github/scripts/install-tools.sh` (new) | Downloads Task and golangci-lint for Linux or Windows (Git Bash), checks SHA-256, adds them to `GITHUB_PATH` |
| `.github/dependabot.yml` (new) | `github-actions`, `npm` (`/frontend`; TypeScript ≥ 7 and `@types/node` ≥ 27 ignored), `gomod` (`/backend`), `docker-compose` (PostgreSQL ≥ 19 ignored); weekly, 14-day cooldown |
| `Taskfile.yml` | Variables `REQUIRED_TASK_VERSION`, `GOVULNCHECK_VERSION`, `GO_TEST_FLAGS`. Tasks `check`, `tools:verify` (`:go`, `:go-toolchain`, `:web`, `:task`), `fmt:check` (`:go`, `:web`), `typecheck`, `i18n:check`, `vuln` (`:go`, `:web`), `deps:config`, `check:eol` |
| `frontend/scripts/check-i18n.ts`, `check-i18n.spec.ts` (new) | i18n gate and 9 tests |
| `frontend/package.json`, `vite.config.ts`, `tsconfig.node.json` | `i18n:check` script; Vitest and type checking include `scripts/` |
| `frontend/pnpm-workspace.yaml` | `auditConfig.ignoreGhsas` with the three accepted advisories |
| `backend/internal/testsupport/proctest/` (new) | Unix-only helper: re-runs the test binary as the real process, waits for readiness, sends a signal |
| `backend/cmd/{api,worker}/signal_unix_test.go` (new) | SIGTERM and SIGINT → exit code 0 and shutdown log lines (PQ-002 follow-up) |
| Docs | `setup.md` (commands, quality gates, CI, vulnerability exceptions, Dependabot, updating tools, GitHub settings), `README.md`, `docs/frontend/architecture.md`, D-17 entry, `TASKS.md` |

Implementation notes:

- **Task shell on Windows.** `node --version` output ends with CRLF on Windows, and command substitution strips only the LF, so the version checks remove a trailing CR explicitly.
- **`deps:config` and `backend/.env`.** Task's `dotenv` loads a local `backend/.env`, and shell variables override `--env-file`, so a variable missing from `.env.example` would go unnoticed locally. The task unsets every `PQ_*` key from both files first. (Found by a failure proof.)
- **Windows zip extraction** uses `powershell.exe Expand-Archive` from Git Bash.

## 4. Verification (Windows 11, 2026-11-09)

| # | Check | Result |
| --- | --- | --- |
| 1 | `task check` (all gates) on Windows | Pass: 0 lint issues, 30 frontend tests (21 + 9 new), Go tests, both builds, govulncheck "No vulnerabilities found", `pnpm audit` "3 ignored", compose valid, no CRLF |
| 2 | Backend on Linux: `docker run golang:1.27.3-trixie … go test -race -count=1 ./...` | All packages pass; `TestAPIStopsGracefullyOnSignal` and `TestWorkerStopsGracefullyOnSignal` pass for SIGTERM and SIGINT |
| 3 | golangci-lint with `GOOS=linux` (lints the Unix-only files) | 0 issues |
| 4 | `install-tools.sh` on Linux (container) and Windows (Git Bash) | Checksums OK; Task 3.54.0 and golangci-lint 2.15.0 run |
| 5 | YAML of workflows, Dependabot and Taskfile | Parsed and formatted by Prettier. **actionlint was not run** (running its container was not permitted in the session); GitHub validates workflows on the first push |
| 6 | Working tree after all proofs | Unchanged apart from the PQ-004 files |

**Failure proofs** — each made one temporary change, ran one gate and was undone; every gate exited non-zero:

| Gate | Temporary change |
| --- | --- |
| `fmt:check:go` | Unformatted Go file |
| `lint:go` | Unchecked error (errcheck) |
| `build:go` | Undefined identifier |
| `test:go` | Failing Go test |
| `fmt:check:web` | Prettier violation |
| `lint:web` | Bare string in a template |
| `typecheck` | Type error |
| `i18n:check` | Missing key in a template; Cyrillic string literal in a `.ts` file |
| `test:web` | Failing Vitest test |
| `build:web` | Import of a missing module |
| `tools:verify:web` | Node 24 first on PATH |
| `tools:verify:go-toolchain` | `toolchain go1.27.2` in `go.mod` |
| `tools:verify:task`, `lint:go-version` | Different required versions |
| `install-tools.sh` | Tampered SHA-256 (`sha256sum: … did NOT match`) |
| `vuln:web` | Advisory removed from the exception list |
| govulncheck | Scratch module calling `language.ParseAcceptLanguage` from `golang.org/x/text` v0.3.7 (GO-2022-1059). Calling only `language.Parse` was correctly *not* reported (reachability) |
| `deps:config` | `PQ_DB_USER` removed from `.env.example` (failed only after the `dotenv` fix above) |
| `check:eol` | File committed with CRLF in a scratch repository |
| SIGTERM test | In a Linux container, a backend copy without SIGTERM handling: the `terminated` subtest fails (exit code −1), `interrupt` passes |

## 5. Known limitations

- **Not yet run on GitHub.** The workflows have not executed; the first pull request is the real test (section 6).
- **Windows jobs are slower** (setup and `pnpm install`), so pull requests wait for them.
- **i18n check limits:** keys are found with patterns, not a full parser; Latin string literals in scripts are not detected; unused keys are warnings only.
- **Dependabot:** the `docker-compose` tag-plus-digest behaviour and pnpm 12's lockfile (`lockfileVersion: '9.0'`, starts with a YAML document marker) are unconfirmed until its first run.
- **govulncheck covers the standard library:** a new Go security release turns CI red until the toolchain is bumped (intended).
- **Accepted advisories** must be reviewed by 2026-12-07 [A].

## 6. Owner steps

1. Commit PQ-004 on a branch, push it and open a pull request to `main`. Expected: all jobs green, including `backend (windows-2025)` and `frontend (windows-2025)`.
2. Configure GitHub (`setup.md`, "GitHub repository settings"): ruleset for `main` with the required check `ci`; Actions restrictions; Dependabot alerts and security updates; secret scanning and push protection.
3. **CI failure proof:** on a throwaway branch from the PQ-004 branch, add one failure per job (failing Go test, missing i18n key, an advisory removed from the exception list, a variable removed from `backend/.env.example`), push it and open a draft pull request. Expected: every job and `ci` red, merge blocked by the ruleset. Then change `REQUIRED_TASK_VERSION` to another value and push: `Verify tool versions` fails in every job. Close the pull request and delete the branch.
4. Run `Vulnerabilities` once manually (Actions → Vulnerabilities → Run workflow).
5. After Dependabot's first run, check the `docker-compose` proposal (tag and digest) and that the npm update works with the pnpm 12 lockfile.

PQ-004 is marked DONE after steps 1–3 succeed.
