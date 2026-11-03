# Documentation Update — 2026-11-03 (PQ-002 preparation)

Documentation-only clarifications approved by the owner on 2026-11-03 before PQ-002 starts. No approved decision was changed; the edits record decisions taken in the PQ-002 plan review (D-17) and fix inconsistencies. No application code was written and no dependencies were installed. Previous sync: `documentation-sync-2026-11-03-r4.md` (committed as `785c904`).

The decision record (`decision-review-2026-11-03.md`) and the earlier sync logs are historical and were not edited.

## Changes

| # | Document | Change | Reason |
|---|---|---|---|
| 1 | `CLAUDE.md` §3 | Worker described as "same codebase and Docker image as the API, separate `cmd/worker` entry point" instead of "same binary" | Two entry points (`cmd/api`, `cmd/worker`) produce two binaries; owner decision: one codebase and one image |
| 2 | `docs/architecture/overview.md` | "One backend codebase and container image (entry points `cmd/api` and `cmd/worker`)"; diagram label "(same codebase)" | Same as 1 |
| 3 | `docs/architecture/api-contracts.md` | `/healthz` and `/readyz` served at the root, outside `/api/v1` | Owner decision: root-level health endpoints for infrastructure probes |
| 4 | `docs/architecture/overview.md` | Paragraph on the single-origin model (Vite proxy locally, reverse proxy on staging/production; no CORS; D-04 assumes same-origin) | Previously implied but not stated |
| 5 | `docs/frontend/architecture.md` (Stack) | Vue I18n confirmed (Composition API mode); locale messages precompiled at build time | Library confirmed; runtime message compilation would conflict with the strict CSP required in PQ-054b |
| 6 | `docs/frontend/architecture.md` (i18n) | ESLint rule `vue/no-bare-strings-in-template` catches bare template strings from PQ-002; missing-key validation and CI enforcement are separate, in PQ-004 | Clarifies which check lands in which task |
| 7 | `docs/frontend/architecture.md` (i18n) | CLDR plural rules via `Intl.PluralRules` (one / few / many / other; fractions use `other`) | Russian fractions use the CLDR `other` category |
| 8 | `docs/frontend/architecture.md` (i18n) | Dates and numbers via `Intl`, exposed through Vue I18n datetime/number formats and shared formatters | States the mechanism |
| 9 | `docs/frontend/architecture.md` (i18n) | One shared, reusable language switcher; a new language = locale folder + locale registration, no new switcher, no component changes | Owner clarification |
| 10 | `docs/architecture/decisions/ADR-024-internationalization.md` | Library named (Vue I18n, precompiled messages); "English or another language" registered with the shared switcher; status notes library confirmation | Same as 5 and 9 |
| 11 | `docs/frontend/architecture.md`, `docs/analysis/implementation-roadmap.md` | Robots meta tag `noindex, nofollow` (matches the PQ-054a header); set by the build-time flag `VITE_ROBOTS_NOINDEX`, separate staging and production builds | Consistency; owner decision on a build-time flag |
| 12 | `docs/development/setup.md` | "Slices S0–S1" instead of "Phase 0"; prerequisites: Go 1.27.x with the `go` directive and `toolchain` line added in PQ-002 (semantics stated accurately; CI version pinned in PQ-004), Node.js 26 LTS (`.node-version`), pnpm (`packageManager`; installed separately because Node 25+ no longer bundles Corepack), Task | Records the approved toolchain without claiming pins that do not exist yet |
| 13 | `docs/analysis/risks-and-open-questions.md` (D-17) | Marked partly decided: Go 1.27, Node 26 LTS, pnpm, Task, TypeScript 6.0, Vue 3.5, Vite 8, Vue I18n; router, DB access and migrations → PQ-005; local S3 → PQ-007; PostgreSQL version → PQ-003 | Owner decisions of 2026-11-03 |
| 14 | `TASKS.md` (PQ-003, PQ-005, PQ-007) | One line each recording the deferred D-17 items | Same as 13 |
| 15 | this file | New change log | Traceability |

## Traceability note

ADR-006, ADR-007 and ADR-013 carry the status note "updated 2026-11-03" (wording updated; MVP scope narrowed; updated), but neither `documentation-sync-2026-11-03.md` nor `documentation-sync-2026-11-03-r4.md` lists them. Their content is consistent with the approved decisions; this note only closes the gap in the change history.
