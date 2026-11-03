# Documentation Sync — 2026-11-03 (Decision Record Revision 4)

Documentation-only change applying the owner's approval of all 17 items of the Revision 4 proposal, with four clarifications. No application code was written and no dependencies were installed. Previous sync: `documentation-sync-2026-11-03.md`.

## Decisions incorporated

| Area | Decision | Owner clarification included |
|---|---|---|
| Jobs | One table as a **transactional job queue**; in-process events, **no stored event history**; unique event-handler jobs; lease-token fencing; classified retries; dead jobs with final-failure hook; operator requeue and user retry | — |
| Equipment | Canonical brands/models, immutable aliases (brand + model text), provisional models, admin-only verification; **merges as edges** with exact undo; original names preserved | **Maximum chain depth enforced at merge creation**; tests for long chains, cycles, brand merges, undo |
| Locations | Admin-curated places; `source` column; suggestions/imports additive later | — |
| AI Coach | Standalone on own drafts/published posts; Coach-owned general rubrics; private feedback; feature-flagged MVP extension | — |
| Profiles | Unique handles (rules, 30-day cooldown, permanent redirects, never reassigned); per-field visibility with owner defaults | — |
| Scope | Pilot essentials / MVP extensions / Future; AI and Learning don't block the pilot; security, backups, monitoring mandatory | — |
| Delivery | Vertical slices S0–S5; task splits PQ-010a/b, PQ-020a/b, PQ-021a/b, PQ-054a/b | **Staging for invited testers only, no indexing, public registration disabled, test-data and consent rules before S5** |
| Media | Private originals; re-encoded variants; no GPS anywhere public; hide deletes public variants, unhide regenerates, delete removes all; time-bucketed signed URLs (B = 1 h, L = 2 h), `private, max-age=3600`; accurate revocation wording | **Provider compatibility checks in PQ-007; emergency rotation explicitly disables the old signing credentials** |
| Photo–location | Link entity with ID and `role = primary`; field renamed `visibility` → **`mode`** (`exact`, `approximate`, `private`); the mode limits all public geography; approximate shows only an area; deterministic two-level grid | **Free-text labels public only in exact mode** |
| Submissions | Private, separate, own Media Assets; no publish-submission; one owner per asset | — |
| Map | D-23: curated places only | — |

Errata fixed in the decision record: section reference §11 → §12; §7.1 reference (7.4) → §7.3 e–f; leftover `public` mode value → `exact`; "transactional outbox" wording qualified.

## Files changed

| File | Change |
|---|---|
| `docs/analysis/decision-review-2026-11-03.md` | Revision 4: approved status, §0 changes and errata, merged R4-1…R4-5 with clarifications, decisions table, open items, approval record |
| `CLAUDE.md` | Decision record in the reading list; [A] values; job-queue terminology; ownership rules (single-owner assets, merge edges, Coach); three tiers; staging rules; privacy rules for modes, labels, re-encoding, revocation wording |
| `README.md` | Pilot essentials vs extensions; location modes; staging note; status (next task PQ-002) |
| `TASKS.md` | Rewritten into S0–S5, pilot gate and extensions; split tasks; new PQ-054a/b; acceptance criteria for every approved decision; staging rule in global rules |
| `docs/product/mvp-scope.md` | Rewritten: tiers, access model, handles, per-field visibility table, equipment, media, location modes table, extensions, future |
| `docs/product/user-flows.md` | Rewritten: handles and redirects, invites on staging, location step choices and label rule, profile privacy, moderation, Coach, Learning, admin equipment |
| `docs/product/vision.md` | Coach on own photos; location mode wording; "Improve a photograph" journey; place page only in exact mode |
| `docs/architecture/overview.md` | Rewritten: environments, module tiers, ownership, job queue terminology, delivery and revocation, location privacy |
| `docs/architecture/modules.md` | Rewritten: module tiers, handles, equipment merges, single-owner Media, `mode`, Coach, cross-module table |
| `docs/architecture/database-schema.md` | Rewritten: invites, handles/history/reserved, visibility columns, equipment tables and merge logs, assets owner/generation/key version, variants key version, raw text + model IDs, `post_locations` with `mode`, `role`, cell fields, jobs, feature flags, Coach subject model |
| `docs/architecture/api-contracts.md` | Rewritten: handle endpoints and redirect response, equipment and admin merge endpoints, retry processing, location shapes per mode (approximate: area only), exact-only place listings, Coach on posts, admin jobs/invites |
| `docs/frontend/architecture.md` | `/u/:handle`, settings toggles, location step wording, area rendering, staging noindex, Coach panel, tests |
| `docs/media/media-and-exif.md` | Rewritten: lifecycle, re-encoding, delivery algorithm, revocation table and wording, runbook, provider checks |
| `docs/ai/coach-specification.md` | Rewritten: standalone subject/context model, rubric ownership, privacy, guardrails, pipeline |
| `docs/development/coding-standards.md` | Idempotent handlers with fencing; allowlisted serializers; privacy, location, profile and merge tests |
| `docs/development/setup.md` | Environments incl. staging rules; jobs CLI; staging reset and invites; seed data list |
| ADR-004 | One owning entity per Media Asset |
| ADR-005 | Retitled "Internal Events and Transactional Job Queue"; no event history |
| ADR-008 | Standalone Coach, subject/context, private, extension |
| ADR-011 | Canonical model, provisional, merges as edges, depth at creation, undo |
| ADR-014 | Re-encoded variants; key versions; hide/unhide/delete |
| ADR-015 | Modes; mode limits all public geography; labels exact-only; deterministic grid |
| ADR-018 | Tiers; slices; staging; mandatory operations |
| ADR-019 | Per-field profile visibility; handles; staging exception |
| ADR-020 | Accepted; link entity with role and `mode`; exact-only place listings |
| ADR-021 | Accepted; raw text + model IDs; backfill |
| ADR-022 | Accepted; full mechanics and terminology |
| ADR-023 | Accepted; algorithm, cache headers, revocation, runbook, provider checks |
| ADR-025 | Accepted; S5 placement |
| `docs/analysis/risks-and-open-questions.md` | Decision register: decided vs open (by slice); new risks R-24 (staging exposure) and R-25 (provider URL behaviour); task references updated |
| `docs/analysis/implementation-roadmap.md` | Rewritten: slices, dependency graph, staging and test-data rules, decision checkpoints |
| `docs/analysis/documentation-sync-2026-11-03-r4.md` | New — this changelog |

Unchanged: ADR-001, 002, 003, 006, 007, 009, 010, 012, 013, 016, 017, 024; `docs/analysis/product-review.md` and `architecture-review.md` (historical analyses with status notes); `documentation-sync-2026-11-03.md` (previous changelog).

## Consistency checks performed

- Searched all current documents for stale terms (`public` location value, `visibility` on post locations, `profile_visibility`, `/u/{userId}`, `submission_id` on analyses, old equipment columns, `merged` status, "transactional outbox" without qualification, unsplit task IDs, "existing URLs fail immediately", "key rotation"). Remaining matches are only in historical documents or in text that describes the change.
- Verified that every task ID in `TASKS.md` appears in `implementation-roadmap.md` (except the completed PQ-000/PQ-001) and that slice membership is identical in `TASKS.md`, the roadmap and decision record §6.3.
- All ADRs 001–025 now have status Accepted.

## Still open

All open decisions remain open and are listed in `risks-and-open-questions.md` §1.2: D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-11, D-13, D-14, D-15, D-16, D-17, D-18, D-20, D-21, D-22, M-08, Q-7, R-07.

## Next step

**PQ-002 — Create project skeleton**, starting with the D-17 proposal. Not started; waiting for owner approval.
