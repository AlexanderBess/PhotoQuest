# Documentation Sync — 2026-11-03

Documentation-only change implementing the product owner's decisions of 2026-11-03. No application code was written and no dependencies were installed.

## Owner decisions applied

| Decision | Recorded in |
|---|---|
| Option C — narrowed discovery-first MVP | ADR-018 |
| Core vs supporting vs out-of-scope features | ADR-018, `mvp-scope.md`, `CLAUDE.md §5` |
| Russian UI, English-ready i18n | ADR-024 |
| Public photo, location (and profile) pages viewable without registration; auth for personal actions | ADR-019 |
| Location visibility per photo: public / approximate / private | ADR-015 (updated) |
| Exact GPS never public automatically | ADR-015, `media-and-exif.md`, `CLAUDE.md §6` |
| Review/edit Shooting Details before publishing | `mvp-scope.md`, `user-flows.md`, PQ-021/022 |

Public profiles were added to the public-access list as a direct consequence of public photo pages showing author attribution; profile privacy semantics remain open (D-19).

## Architecture decisions proposed in this sync (status "Proposed")

These come from the earlier analysis and are needed to remove contradictions. They become Accepted when the owner approves this sync.

| ADR | Topic |
|---|---|
| ADR-020 | Community owns photo–location links and visibility; Explore owns location records |
| ADR-021 | Shared Shooting Details value type (shared kernel) |
| ADR-022 | `platform.jobs` as transactional outbox + queue |
| ADR-023 | Storage adapter and media delivery (provider/delivery method still open) |
| ADR-025 | Moderation module |

## Files changed

| File | Change | Why |
|---|---|---|
| `CLAUDE.md` | Rewrote §2 product context, §5 MVP boundaries; added ADR status meaning, ownership rules, authorization, privacy rules, i18n rule, OpenAPI-first step | Removed the direct contradiction (feed/maps were out of scope) |
| `README.md` | Discovery-first description, MVP list, status | Aligned with ADR-018 |
| `docs/product/vision.md` | Minor: discovery primary, MVP notes (curated locations, no social yet), publish journey, content-supply metric, no payments in MVP | Consistency; vision itself unchanged |
| `docs/product/mvp-scope.md` | Rewritten: access model, core/supporting/out-of-scope, location visibility, search/filter, Option C narrowing | Owner decisions |
| `docs/product/user-flows.md` | Rewritten: anonymous browsing, onboarding/recovery, find place, publish, save, report, admin locations; learning flows kept as supporting | Discovery flows were missing |
| `docs/architecture/overview.md` | Module table incl. Community/Explore/Moderation; ownership, authorization, jobs, media processing sections; layout | Was learning-first |
| `docs/architecture/modules.md` | MVP/Future status; post-location ownership moved to Community; Admin owns no tables; shared kernel | Fixed ownership contradiction (A-5) |
| `docs/architecture/database-schema.md` | Added community, explore, moderation, password reset, roles, variants, jobs, audit, analytics; shared Shooting Details columns incl. `software`; removed `location_label` from Shooting Details; minimal billing | Model existed only for learning |
| `docs/architecture/api-contracts.md` | Access markers; posts, feed, bookmarks, locations, saves, reports, admin, password reset, account deletion, events; location representation per visibility | Endpoints were missing |
| `docs/frontend/architecture.md` | Public/auth/admin routes; i18n section; map adapter; SEO note; testing | Routes were learning-only; i18n decision |
| `docs/media/media-and-exif.md` | Processing steps (orientation, colour, strip), variants, GPS handling, `software`, review before publish | Gaps A-6, R-11 |
| `docs/ai/coach-specification.md` | Supporting status; submissions only; allowance reserve/release; Russian output; no GPS to provider | Consistency |
| `docs/development/setup.md` | Worker process, local storage, seed and type-generation commands | Consistency |
| `docs/development/coding-standards.md` | Viewer-context authorization, idempotent jobs, i18n, OpenAPI-first, privacy tests | Consistency |
| ADR-004, 005, 006, 007, 011, 013, 015 | Updated wording/scope | Referred to Community as future; MVP billing narrowed; three visibility levels |
| ADR-018 … ADR-025 | New | See tables above |
| `TASKS.md` | Rewritten (see below) | Proposed changes T-1…T-14 + new decisions |
| `docs/analysis/*` | Status notes on reviews; decision register and roadmap updated; this change log | Keep analysis current |

Unchanged: ADR-001, 002, 003, 008, 009, 010, 012, 014, 016, 017 (consistent with the decisions).

## Review of proposed TASKS.md changes T-1 … T-14

| # | Proposal | Disposition | Explanation |
|---|---|---|---|
| T-1 | PQ-000 resolve scope + align docs | **Applied**, marked DONE | Completed by this sync. |
| T-2 | PQ-005 platform baseline | **Applied** | Needed by every feature. |
| T-3 | PQ-006 jobs/outbox + worker | **Applied** | Prerequisite of PQ-020/042 (ADR-022). |
| T-4 | PQ-007 storage adapter | **Applied**, extended | Also covers the delivery method needed for anonymous viewers (ADR-023). |
| T-5 | PQ-013 roles/admin authorization; move protection AC from PQ-050 | **Applied**, extended | Now also resolves the anonymous viewer context required by public pages (ADR-019). |
| T-6 | PQ-014 analytics event capture early | **Applied** | Adds a rule for anonymous visitors (no IP, opaque ID). |
| T-7 | Password reset, account deletion in PQ-010 | **Applied** | Delivery channel is open (D-21). |
| T-8 | Onboarding in PQ-011 | **Applied, changed** | Onboarding is now discovery-first: experience level, optional gear, optional Instagram; learning goals removed. Public profile added. |
| T-9 | `software` field + orientation | **Applied** | In PQ-020/021 and docs. |
| T-10 | GPS retention decision in PQ-020 | **Applied** | Still open (D-08); owner rule "never public automatically" recorded. |
| T-11 | Precision options in PQ-032; Community ownership | **Applied, changed** | Uses the owner's three levels; ownership in ADR-020. |
| T-12 | Reorder: feed after Explore; moderation before learning; PQ-043 before PQ-042 | **Partially applied** | Moderation before learning and PQ-043 before PQ-042 applied. **Feed-after-Explore not applied:** the feed is now an explicitly core, public feature, cheap once publishing exists, and the first public surface for testing publishing end to end. |
| T-13 | Per-feature "OpenAPI + DB model updated" AC | **Applied, changed** | The DB logical model for all MVP features was written in this sync, so the per-task rule is reduced to "write OpenAPI before implementing", stated once in the TASKS.md global rules and CLAUDE.md §8 instead of repeated in each task. |
| T-14 | Terms/consent before first public upload | **Applied** as PQ-053 | Also covers legal pages being public. |

## Additional TASKS.md changes from the owner decisions

- PQ-002: i18n setup with `ru` default; toolchain proposal moved here from PQ-001.
- PQ-003: local S3-compatible storage and worker added.
- PQ-022/023: public (anonymous) viewing; draft → publish flow.
- **PQ-034 (new):** basic search and filtering — core per owner.
- PQ-040: seeded content, no admin editor (Option C).
- PQ-042: submissions only.
- PQ-043: minimal entitlements, no plans (Option C).
- Phase order: 0 Foundation → 1 Identity/authorization/profiles → 2 Media/publishing/feed → 3 Explore → 4 Pilot safety → 5 Learning & Coach → 6 Pilot readiness. Task IDs kept stable.
