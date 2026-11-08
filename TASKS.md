# PhotoQuest — Implementation Backlog

This backlog is the execution source of truth. Work slice by slice, top to bottom, unless a dependency or an explicitly approved change requires otherwise.

**Product direction:** narrowed discovery-first MVP (ADR-018). Pilot essentials: profiles with handles and per-field visibility, equipment, photo publishing and public feed, Shooting Details, Explore and curated places, photo–location modes (exact / approximate / private), basic search and filtering, saving, moderation, privacy and legal, **security, backups and monitoring**. MVP extensions (may ship during the pilot): standalone AI Coach, Learning. Russian UI, i18n-ready (ADR-024). Public pages viewable without an account in production (ADR-019).

**Decision record:** `docs/analysis/decision-review-2026-11-03.md` (Revision 4, approved 2026-11-03). **Roadmap:** `docs/analysis/implementation-roadmap.md`.

Status values: `TODO`, `IN PROGRESS`, `BLOCKED`, `DONE`.

**Global rules for every task**
- Read the ADRs referenced by the task and any open decision listed under "Blocking decisions"; ask before coding if one is still open.
- Write or update the OpenAPI schema before implementing an endpoint; the logical data model is in `docs/architecture/database-schema.md`.
- Every endpoint has authorization tests (anonymous / owner / other user / admin as relevant) and, where it returns photos, locations or profiles, privacy tests.
- No hard-coded user-facing strings in the frontend.
- Capture the analytics events listed for the feature once PQ-014 defines the taxonomy (earlier slices note their events in the task report).
- **Until S5 is complete and the pilot gate is passed, only the staging environment exists for testers: invited testers only, access gate, public registration disabled, no indexing, test-data and consent rules from the roadmap.**

Task IDs are stable. Suffixes `a`/`b` mark tasks split across slices (approved 2026-11-03).

---

## Phase 0 — Analysis and decisions (done)

### PQ-000 — Resolve MVP scope and align documentation
**Status:** DONE (2026-11-03) — ADR-018; documentation aligned twice (`documentation-sync-2026-11-03.md`, `documentation-sync-2026-11-03-r4.md`).

### PQ-001 — Inspect repository and propose implementation plan
**Status:** DONE (2026-11-03) — `docs/analysis/`; toolchain proposal (D-17) moved to PQ-002.

---

## S0 — Walking skeleton

### PQ-002 — Create project skeleton
**Status:** DONE (2026-11-08) — per `docs/analysis/pq-002-implementation-plan.md` (Revision 5), checks run on Windows; the owner re-runs section 7.2 to confirm. SIGTERM handling is covered by Linux-only tests added in PQ-004 (`backend/cmd/*/signal_unix_test.go`), run in CI.
**Blocking decisions:** D-17 (resolved inside this task's plan)
**Acceptance criteria:**
- Plan proposes toolchain versions, package manager, Go router/DB-access/migration tools and frontend libraries (router, Pinia, i18n, test tools) for approval before scaffolding.
- `backend/` with `cmd/api` and `cmd/worker` entry points; minimal `/healthz`.
- `frontend/` starts and renders a minimal shell.
- Frontend i18n: `ru` default/fallback, locale files, no hard-coded strings, Russian plural rules verified by a test.
- Environment-driven `noindex` flag available in the shell (used by staging).
- Root README explains local startup. No product-domain features.

### PQ-003 — Local development environment
**Status:** DONE (2026-11-09) — per `docs/analysis/pq-003-implementation-plan.md`; PostgreSQL 18.6 (D-17 / OD-17); provisional local S3 SeaweedFS 4.52 (OD-13 open until PQ-007); checks run on Windows 11 with Docker Desktop 4.98.0.
**Acceptance criteria:**
- Docker Compose starts PostgreSQL and a local S3-compatible storage service.
- Environment example files without secrets; configuration documented.
- Health checks for local dependencies; documented commands start API, worker and frontend.
- Finalises the PostgreSQL version and local database setup (D-17).

### PQ-004 — Quality gates
**Status:** DONE (2026-11-09) — implemented per `docs/analysis/pq-004-implementation-plan.md`: GitHub Actions CI on `ubuntu-24.04` and `windows-2025` with a single required check `ci`; `task check` runs the same gates locally; i18n check `frontend/scripts/check-i18n.ts`; govulncheck v1.9.0 and `pnpm audit` (3 dev-only advisories accepted until 2026-12-07); Dependabot; SIGTERM/SIGINT tests for API and worker. All gates and 20 failure cases verified locally (Windows; backend tests and SIGTERM in a Linux container). Verified on GitHub: PR #1 green on Linux and Windows; a deliberate-failure PR turned every job and `ci` red; the `main` ruleset requires `ci` and blocks the merge. Open: confirm Dependabot's first `docker-compose` and npm proposals; review accepted advisories by 2026-12-07.
**Acceptance criteria:**
- Formatting, lint and test commands documented; CI runs frontend and backend checks; failures fail the pipeline.
- i18n check (missing keys; raw template strings where practical).
- Dependency vulnerability scanning (tool chosen in D-17).
- No deployment pipeline yet (staging deploy is PQ-054a).

### PQ-005 — Platform baseline
**Status:** TODO
**Blocking decisions:** D-05
**Acceptance criteria:**
- Validated configuration; structured logging redacting tokens, signed URLs, storage keys, coordinates and labels.
- Error envelope with stable codes; migration tool wired; logical schemas created empty.
- OpenAPI skeleton with generated Go and TypeScript types (per D-05).
- `/healthz` and `/readyz`; feature-flag lookup (`platform.feature_flags`); allowlisted-serializer convention documented.
- Extends PQ-002's minimal health endpoint, configuration and logging; decides router, DB access and migration tools (D-17).

---

## S1 — Publish and view one photo

### PQ-006 — Transactional job queue and worker
**Status:** TODO
**References:** ADR-005, ADR-022
**Acceptance criteria:**
- `platform.jobs` and `jobs.Enqueue(tx, …)` inside the caller's transaction; `events.Publish(tx, event)` dispatcher inserting one job per registered handler with `dedupe_key = event_id`. Documentation states that events are not stored.
- Claiming with `SKIP LOCKED`, lease token, lease expiry reclaim, optional heartbeat.
- Completion and failure updates fenced by the lease token.
- Transient/permanent error classes, capped backoff with jitter, `max_attempts`, `dead` with `OnFinalFailure` in the same transaction.
- Operator requeue (CLI and admin endpoint, audit-logged); periodic jobs with per-period dedupe keys; retention of succeeded rows.
- Tests: commit enqueues / rollback does not; duplicate publish creates one job per handler; concurrent workers don't double-run; expired lease is reclaimed and the stale worker's completion is discarded; retries then `dead`; requeue.
- Hand-rolled unless a library is explicitly approved in the plan.

### PQ-007 — Storage adapter and provider checks
**Status:** TODO
**References:** ADR-014, ADR-023
**Blocking decisions:** D-03 (provider can stay local-only until PQ-054a)
**Acceptance criteria:**
- Storage interface (put, get, delete, presign) against the local S3-compatible service; private bucket; opaque keys never logged.
- Time-bucketed presigning (B = 3600 s, L = 7200 s, signing time = bucket start) and 5-minute owner URLs; cache headers per ADR-023.
- **Provider compatibility checklist** implemented as an automated test suite and run against the local service now and the chosen provider in PQ-054a: past signing time accepted; byte-identical URLs; read-after-delete consistency; `Cache-Control` honoured; disabling a key invalidates its URLs; upload size enforcement option.
- Local S3-compatible service chosen after the compatibility checks (D-17, OD-13): PQ-003 added SeaweedFS 4.52 as a **provisional** service; confirm it or replace it (Garage is the first alternative). Unverified for SeaweedFS: `Cache-Control` overrides and key disabling.

### PQ-010a — Identity core
**Status:** TODO
**Blocking decisions:** D-04 (auth mechanism, recorded as an ADR), D-16
**Acceptance criteria:**
- Registration, login, logout; reputable password hashing; session lifecycle and revocation; CSRF protection if cookies are used.
- Registration can be disabled by configuration; invite codes (`identity.invites`) for staging.
- Rate limiting and account-enumeration protections; tests for validation and authentication failures.

### PQ-013 — Roles and authorization baseline
**Status:** TODO
**References:** ADR-019
**Acceptance criteria:**
- `role` on users; admin assignment via CLI/seed only.
- Viewer-context middleware; admin route group rejects non-admins; admin use cases re-check the role.
- Platform audit log.
- Tests for anonymous, user and admin on sample public, authenticated and admin endpoints.

### PQ-020a — Media pipeline core (JPEG)
**Status:** TODO
**References:** ADR-004, ADR-012, ADR-014, ADR-015, ADR-022, ADR-023, `docs/media/media-and-exif.md`
**Blocking decisions:** D-07, D-08, upload limits (M-08)
**Acceptance criteria:**
- Spike first with real camera/phone fixtures (rotated, GPS, XMP location, embedded thumbnails, Display P3, Adobe RGB, CMYK, grayscale).
- Upload intent → `incoming/` → completion with size and signature verification → `originals/` → processing job in the same transaction.
- Pixel limit before decode; size and rate limits.
- EXIF allowlist extraction; raw strings preserved; never stored: serials, owner/artist, MakerNotes, XMP/IPTC location; GPS per D-08.
- Orientation applied; sRGB conversion; **re-encoded** variants under a random `key_version`.
- Each asset has exactly one owning entity.
- Owner-visible processing status; recoverable failure; "Retry processing" (new generation).
- **Privacy contract tests** on every variant.

### PQ-021a — Shooting Details value type and review
**Status:** TODO
**References:** ADR-013, ADR-021
**Acceptance criteria:**
- Shared value type (camera/lens `*_raw_text` + nullable `*_model_id`, focal length, aperture, shutter speed, ISO, exposure compensation, flash, capture time + offset, software; per-field provenance).
- Normalisation from EXIF; missing values never fabricated; model IDs left null until PQ-021b.
- Review and correction before publishing; editing after publishing; capture time removable.

### PQ-022 — Post drafts, publishing and photo page
**Status:** TODO
**Acceptance criteria:**
- Draft from an owned asset; publish requires a ready asset (terms acceptance enforced once PQ-053 lands; until then only invited testers can publish on staging).
- Title/caption, attribution, own Shooting Details snapshot.
- Public photo page (anonymous) with compact and expanded Shooting Details; drafts owner-only (5-minute URLs).
- Owner edit and delete; deletion stops URL issuance immediately and deletes all files via jobs.
- Delivery uses time-bucketed URLs for published posts.

### PQ-054a — Staging environment
**Status:** TODO
**Blocking decisions:** D-11 (hosting), D-03 (provider)
**Acceptance criteria:**
- Staging deploy of API, worker and frontend over HTTPS.
- **Access:** access gate in front of the whole site (e.g. basic auth or IP allowlist at the reverse proxy); public registration disabled; invite codes only.
- **No indexing:** `X-Robots-Tag: noindex, nofollow` on every response, `robots.txt` disallow-all, `noindex` meta tag; verified by a test request.
- Separate database, bucket, credentials and secrets from production; no data copying in either direction.
- Staging reset command (database and bucket) documented.
- Provider compatibility checklist (PQ-007) passes against the chosen provider.
- Emergency signing-credential rotation rehearsed once, including **disabling the old credentials** and verifying an old URL is refused.
- Tester onboarding note (test-data and consent rules from the roadmap) written; acknowledgements recorded before access.

---

## S2 — Browse and profile

### PQ-023 — Public feed and photo bookmarks
**Status:** TODO
**Acceptance criteria:**
- Anonymous, cursor-paginated, reverse-chronological feed of published, non-hidden posts.
- Save/unsave photos (idempotent); saved photos in the Library.
- Loading, empty, error and unavailable states.
- Feed never exposes drafts, hidden posts or non-public location data.

### PQ-011 — Profiles, handles, visibility, onboarding
**Status:** TODO
**References:** ADR-019
**Acceptance criteria:**
- Handle rules: lowercase `a–z0–9_`, 3–30, starts with a letter, no leading/trailing/double underscore; case-insensitive; reserved handles seeded; availability endpoint rate-limited.
- Handle change every 30 days [A]; `handle_history`; old handles return `redirect_to`; never reassigned; deleted accounts' handles reserved without personal data; admin forced change (audit-logged).
- Display name, avatar (processed as a media asset), bio, experience level (values defined).
- Per-field visibility: bio default private, equipment default public, Instagram default private, experience level private; identical for anonymous and signed-in viewers; tests per field.
- Public profile at `/u/:handle` with published photos.
- Skippable, resumable onboarding: handle, experience level, optional gear, optional Instagram link.
- Instagram URL/username only; no OAuth, import or insights.

---

## S3 — Find a place

### PQ-030 — Location model and editorial management
**Status:** TODO
**Acceptance criteria:**
- Explore owns places, categories, descriptions, practical notes, status, exact (private) and public coordinates/precision, `source = editorial`.
- Admin create/edit/publish/archive, audit-logged.
- Exact coordinates not returned publicly when precision is approximate (deterministic grid snapping).
- Pilot seed data loads without hard-coding one city.

### PQ-031 — Map and place discovery
**Status:** TODO
**Blocking decisions:** D-06
**Acceptance criteria:**
- Anyone can browse published places on a map (curated places only, D-23) and in a list; place pages show exact-mode photos via Community.
- Map provider behind the frontend adapter; approximate areas rendered as areas, never pins.
- No unsupported claims about access, hours, weather or safety.

### PQ-032 — Photo–location links and modes
**Status:** TODO
**References:** ADR-015, ADR-020
**Blocking decisions:** D-20 (cell sizes), D-08
**Acceptance criteria:**
- `post_locations` with own ID, `role = primary`, unique (`post_id`, `role`), `mode`.
- Location step: "Show the place", "Show only the general area" (preview; "area" default, "neighbourhood" opt-in with warning), "Don't show the location"; personal point is a separate action needing exact mode and confirmation.
- Public output exactly as ADR-015: exact → place/point/label; approximate → area only (no place, no label, no listing, no filter); private → nothing.
- Deterministic metric-aware grid; coarser of chosen level and place precision; no jitter; exact point never leaves the server outside exact mode.
- All geo queries, filters and counts use the public representation only.
- EXIF GPS never becomes public automatically.
- **Privacy invariant tests:** for every mode and for anonymous viewers, no public output finer than the mode, including labels, place listings, filters and counts.

### PQ-033 — Saved places and Library
**Status:** TODO
**Acceptance criteria:**
- Save/unsave places (idempotent); Library shows saved places and photos.
- No viewer location data collected.

---

## S4 — Gear and search

### PQ-012 — Canonical equipment and user gear
**Status:** TODO
**References:** ADR-011
**Blocking decisions:** D-15 (seed list)
**Acceptance criteria:**
- Brands, models, immutable aliases (key = normalised brand + model text), provisional models on unknown input; seed list verified.
- Verification only by admin action (audit-logged).
- Merges as edges: maximum chain depth **enforced at merge creation**, cycles rejected, row locks; exact undo; brand merges with the same rules; admin endpoints for verify, merge, undo, alias deletion.
- `ResolveEffective` and `ModelsResolvingTo`.
- User gear stores resolved model and original entered text; equipment optional.
- **Tests:** long chains (D accepted, D + 1 rejected from either end), cycles (self, indirect, concurrent), brand merges (no alias/model rows changed), undo (only in-effect merges, idempotent), history unchanged.

### PQ-021b — Equipment resolution and backfill
**Status:** TODO
**Acceptance criteria:**
- Shooting Details resolve camera/lens raw text to models via Equipment; original text kept.
- One-off backfill job resolves snapshots created in S1–S3 from their raw text.
- Display rule: canonical name if the effective model is verified, otherwise original text; expanded view always shows the original.

### PQ-034 — Basic search and filtering
**Status:** TODO
**Acceptance criteria:**
- Places: Russian name search, category, viewport.
- Photos: filter by place (exact-mode links only), camera and lens (merge-aware via `ModelsResolvingTo`).
- Search technique documented; indexes added.
- Filters never surface private or approximate location data or hidden posts.

---

## S5 — Safe for real people

### PQ-050 — Moderation, reporting and admin operations
**Status:** TODO
**References:** ADR-025, ADR-014, ADR-023
**Acceptance criteria:**
- Reports on posts, Shooting Details, post locations, places, profiles and (later) AI feedback.
- Admin lists reports; hide/unhide; fixes place data; resolves or dismisses; audit-logged.
- **Hide** stops URL issuance immediately and deletes public variants via a high-priority job; original and `ai_analysis` kept; owner/admin view via 5-minute URLs. **Unhide** regenerates public variants under a new `key_version`.
- Documentation and UI wording: removal from PhotoQuest is immediate, file deletion follows shortly, copies already delivered cannot be recalled.
- Destructive actions require confirmation.

### PQ-053 — Terms, privacy policy and consent
**Status:** TODO
**Blocking decisions:** legal review R-07; D-02/D-11 for disclosures
**Acceptance criteria:**
- Terms, privacy policy, upload licence and AI-processing disclosure reviewed; they describe revocation limits, backups and handle reservation.
- Users accept the current terms before first publish/submission; acceptance stored.
- Legal pages viewable without an account.

### PQ-010b — Password reset and account deletion
**Status:** TODO
**Blocking decisions:** D-21
**Acceptance criteria:**
- Single-use, time-limited, hashed reset tokens; uniform responses; sessions revoked on reset (manual admin fallback if no email channel).
- Account deletion defined and implemented: profile, posts and all files removed via jobs; handle reserved without personal data; documented in `database-schema.md`.

### PQ-020b — Media completion
**Status:** TODO
**Acceptance criteria:**
- PNG and WebP support; fixtures extended.
- Abandoned-upload cleanup (~24 h [A]), draft expiry (e.g. 30 days [A], Q-7) with UI notice, stuck-asset reconciliation.
- Avatar replacement deletes the old asset.

### PQ-014 — Analytics event capture
**Status:** TODO
**Blocking decisions:** D-13
**Acceptance criteria:**
- Event taxonomy for discovery, saves, Shooting Details expansion, publishing, location modes and (extensions) Coach/learning.
- Server recorder and allowlisted client endpoint.
- No IP addresses, viewer locations, coordinates, labels, image contents or EXIF values.

### PQ-054b — Production environment, backups and monitoring
**Status:** TODO
**Blocking decisions:** D-11, R-07
**Acceptance criteria:**
- Production deploy over HTTPS with security headers (incl. CSP), least-privilege credentials, no public bucket listing.
- Automated daily database backups off the main server; object-storage protection; encryption at rest; retention policy; **restore tested**.
- Monitoring: uptime, error-rate alerts, job-queue health (dead jobs, oldest pending), disk/DB/storage usage, backup-success alerts.
- Emergency credential rotation runbook (including disabling old credentials) documented.
- Production does not inherit staging flags (noindex, access gate, invite-only).

---

## Pilot gate

### PQ-051 — Analytics reporting and product feedback
**Status:** TODO
**Acceptance criteria:**
- Queries/dashboards for pilot metrics: discovery, saves, Shooting Details expansion, publishing, location modes, content supply, weekly meaningful actions, retention by segment.
- In-app link to product feedback.

### PQ-052 — Pilot readiness
**Status:** TODO
**Acceptance criteria:**
- E2E journeys pass: browse anonymously, find a place, inspect Shooting Details, publish with each location mode, save, report, hide/unhide.
- PQ-054b complete (backups restored, monitoring live).
- Staging test data wiped; pilot seed data (places, rights-cleared photos) loaded in production.
- Participant recruitment plan ready (contributors first).

---

## Extensions (may ship during the pilot)

### E1 — AI Coach

#### PQ-043 — Usage limits (minimal entitlements)
**Status:** TODO
**Blocking decisions:** D-14
**Acceptance criteria:**
- Default limit per feature key from configuration; admin per-user overrides (audit-logged).
- Atomic reserve/consume/release; no bypass via direct API calls; remaining allowance visible.

#### PQ-042a — Standalone AI Coach on own posts
**Status:** TODO
**References:** ADR-008, `docs/ai/coach-specification.md`
**Blocking decisions:** D-02, R-07
**Acceptance criteria:**
- Behind a feature flag; analysis of the owner's draft or published post, authorised by Community.
- General context: focus + optional question; Coach-owned general rubrics, versioned.
- Private feedback (strengths, 2–3 improvements, next exercise, limitations) in the UI language; schema-validated; rating and reporting.
- No location data, GPS, raw EXIF or unnecessary profile data sent to the provider.
- Provider/model/prompt/rubric version, usage, latency and outcome recorded; failed analyses release allowance; per-subject cooldown.

### E2 — Learning

#### PQ-040 — Seeded learning content
**Status:** TODO
**Blocking decisions:** D-22
**Acceptance criteria:** small set of paths, lessons and challenges from version-controlled seed data; archived, never hard-deleted; no admin editor.

#### PQ-041 — Challenge participation and progress
**Status:** TODO
**Acceptance criteria:** private submissions with their own Media Assets (never shared with posts); reviewed Shooting Details; progress persisted; duplicate/retry policy defined and tested; no publish-submission feature.

#### PQ-042b — Challenge context for the Coach
**Status:** TODO
**Acceptance criteria:** Learning calls Coach for an owned submission with challenge objective and rubric provided by Content; same engine, allowance and privacy rules.

### E3 — Other extensions
Admin screens (equipment merges/verification, dead jobs), extra filters and collections, link previews (D-18), EXIF-GPS location suggestion (D-08), notifications beyond password reset. Ordered by pilot feedback.

---

## Future roadmap — not MVP implementation tasks

- Rich Community: comments, reactions, follows, groups, events, messaging.
- Advanced Explore: user-submitted locations, external imports, routes, sun/weather, multiple location roles per photo.
- AI on other users' photos; sharing AI feedback; publish-from-submission.
- Academy; plans, subscriptions and payments; Instagram API; Gear Explorer.
- English locale and translated content; native apps; recommendations.

Do not pull future tasks into active work without explicit product approval. Do not generate the whole application in one pass.
