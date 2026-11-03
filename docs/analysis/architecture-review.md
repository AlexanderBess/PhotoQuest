# Architecture Review — PhotoQuest

> **Status update 2026-11-03:** This review is the historical PQ-001 analysis. The owner has since chosen Option C (narrowed discovery-first, ADR-018), Russian UI with i18n (ADR-024), public read access (ADR-019) and three location visibility levels (ADR-015). The scope conflict described below is resolved; current decisions and open items are in `risks-and-open-questions.md`, changes in `documentation-sync-2026-11-03.md`.

- **Task:** PQ-001 (analysis input; no code)
- **Date:** 2026-11-03
- Tags: **[C]** confirmed in docs · **[A]** assumption · **[R]** recommendation (see `product-review.md`).

---

## 1. Verdict

The architecture is **sound and appropriately conservative** for a solo-built MVP: one Go binary (API + worker), one PostgreSQL database with logical schemas, an outbox instead of a broker, explicit module boundaries, provider adapters for AI and storage. No change of style is recommended.

The problems are (a) the architecture documents describe the **learning-first** scope while `TASKS.md` requires the **discovery-first** scope, and (b) several cross-module ownership questions and infrastructure prerequisites are not specified.

---

## 2. Strengths

- Modular monolith with logical schemas (ADR-001/002/003) — right size, easy to extract later.
- Shared Media module with private originals and sanitised derivatives (ADR-004/014/015) — correct privacy default.
- Shooting Details as a snapshot (ADR-013) — avoids history being rewritten by gear edits.
- Coach behind a provider interface with prompt/model/usage recording and schema-validated output (ADR-008, coach spec).
- Entitlements by feature key (ADR-007) — allows packaging later without code changes.
- Instagram as plain profile link (ADR-017) — avoids API dependency.
- Async work via outbox, handlers idempotent (ADR-005).

---

## 3. Inconsistencies between architecture docs and `TASKS.md`

| # | Area | Architecture docs say | `TASKS.md` / `mvp-scope.md` say | Impact |
|---|---|---|---|---|
| A-1 | Module list | `overview.md`: `explore`, `community` are future | PQ-022/023/030–033 implement them | Package layout, schemas |
| A-2 | DB schemas | `database-schema.md`: "Do not create [explore/community] tables in the MVP" | Posts, feed, locations, bookmarks needed | No logical model for ~40% of MVP |
| A-3 | API | `api-contracts.md`: no posts/locations/bookmarks/reports/admin endpoints | All required | No contract for Phase 2–3 |
| A-4 | Frontend routes | Learning routes only | Feed, post, location, map, library needed | Router/FSD slices |
| A-5 | Location ↔ photo ownership | `modules.md` Explore: owns "location-to-photo associations"; `database-schema.md` future notes: `community.post_locations` | — | Ownership ambiguity (see §4.3) |
| A-6 | EXIF field list | `media-and-exif.md` allowlist and `submission_shooting_details` lack **software** | PQ-021 and `mvp-scope.md` include software | Minor: add field |
| A-7 | Admin authorization | Admin module described; protection only appears in PQ-050 (Phase 5) | PQ-030 (Phase 3) and PQ-040 (Phase 4) already need admin | Dependency inversion |
| A-8 | Background worker / storage | `overview.md` requires worker, outbox, S3 storage | No Phase 0 task creates them; PQ-020 assumes they exist | Hidden prerequisite |
| A-9 | Onboarding | `user-flows.md` collects learning goals | PQ-011 mentions resumable onboarding but no task owns the flow | Gap |

All are resolved by D-01 plus a documentation update; none requires a different architecture.

---

## 4. Module boundary review

### 4.1 Module set for the MVP [R]

Twelve modules are described. For one developer, create packages **only when a task needs them** (as `overview.md` already says). Suggested MVP set for the discovery-first direction:

| Module | MVP? | Note |
|---|---|---|
| identity | Yes | Sessions, credentials, roles (admin flag/role lives here or in admin policy — decide) |
| profiles | Yes | Includes Instagram link |
| equipment | Yes, thin | Custom entries first; catalog optional |
| media | Yes | Largest technical module |
| community | Yes (if D-01 = discovery) | Posts, Shooting Details snapshot, feed, photo bookmarks |
| explore | Yes (if D-01 = discovery) | Locations, saved locations |
| content | Yes, thin | Seeded paths/challenges |
| learning | Yes, thin | Submissions, progress |
| coach | Yes | One provider adapter |
| billing | Minimal | Rename scope to "entitlements + usage counters"; no plans/subscriptions tables until payments |
| notifications | Defer | Unless password reset needs email in MVP (then a tiny mail sender in `platform`) |
| admin | Thin | An HTTP route group + authorization policy calling module use cases, not a domain of its own |
| moderation/reports | Decide | `TASKS.md` PQ-050 needs reports; no module owns them (see §4.4) |

### 4.2 Shooting Details appears in two owners

Learning (`learning.submission_shooting_details`) and Community (`community.shooting_details`) each store a snapshot; Media produces extracted values; Equipment supplies normalised names. Without a shared definition, the normalisation and validation rules will be written twice and drift.

**[R]** Define one value type (fields, units, validation, `source`: exif/manual/mixed, per-field provenance if desired) in a small shared-kernel package that has **no persistence and no module dependencies**, used by Media (as extraction output), Community and Learning (as stored snapshots). Each owner keeps its own table, as ADR-013 requires. This is a narrow, concrete exception to "platform has no product rules"; record it in an ADR if accepted.

### 4.3 Location ownership

- Explore owns **location records** (name, category, notes, exact + public coordinates, precision). [C]
- The **association** of a post with a location and the **author's chosen precision** for that post are post data — they should belong to Community (`community.post_locations`), referencing Explore by ID through its public interface. [R]
- Explore then *reads* "public photos for location X" through a Community query interface, not by owning the association. This avoids a two-way write dependency.
- `modules.md` should be updated to match whichever option is chosen (A-5).

### 4.4 Reports and moderation

PQ-050 needs reports on posts, location data, metadata and AI feedback. **[R]** One small `moderation` module (reports table with `target_type` + `target_id`, status, resolution, audit log) whose resolution actions call the owning module's use case (e.g. `community.HidePost`). Keeps admin from writing other modules' tables.

### 4.5 Submission vs post

Undefined whether a challenge submission can become a public post. **[R]** Keep them separate entities that may reference the **same media asset**; "publish this submission" creates a post with a *copy* of the Shooting Details snapshot. Requires a product decision (D-09).

### 4.6 Admin role

No role model exists. **[R]** Minimal: `identity.users.role` (`user`, `admin`) or a separate `identity.user_roles` table, checked by an authorization policy in each admin use case. Needed before PQ-030.

---

## 5. Data model review (`database-schema.md`)

1. **Missing tables** for the discovery-first scope: `community.posts`, `community.post_shooting_details`, `community.post_locations`, `community.photo_bookmarks`, `explore.locations`, `explore.location_categories`, `explore.saved_locations`, `moderation.reports`, `platform.analytics_events` (if self-hosted), password-reset tokens.
2. **`software` field** missing from Shooting Details (A-6). Consider also `capture_timezone`/offset — EXIF `DateTimeOriginal` has no zone unless `OffsetTimeOriginal` is present.
3. **`location_label` on `submission_shooting_details`** mixes location into shooting details; ADR-015 says location is a separate explicit choice. [R] Move it out, or document the exception.
4. **`media.extracted_metadata`**: GPS handling not stated. Options: (a) never store GPS; (b) store privately to suggest nearby locations. (b) is useful for "link to location" UX but stores sensitive data. Decision D-08.
5. **`media.assets`**: add `purpose` (post/submission/avatar), checksum (dedupe/integrity), `variants` relation instead of single `storage_key_public_variant` (web display + AI analysis + thumbnail are ≥2 variants). [R]
6. **Billing**: `plans`, `subscriptions` not needed before payments; `usage_counters` with atomic `UPDATE … SET used = used + 1 WHERE used < limit` is enough for the pilot. [R]
7. **Deletion semantics** are "to be defined" everywhere; must be specified per entity before migrations (account deletion, post deletion, media variant cleanup in storage).
8. **Content versioning**: "changes to published content must not corrupt progress" (`user-flows.md`) — the schema has no versioning. [R] For MVP: never hard-delete published lessons/challenges, only archive; progress references stable IDs.

---

## 6. API review (`api-contracts.md`)

- Conventions are good (envelope, UUIDs, pagination, idempotency).
- **Missing endpoint groups:** posts, feed, photo bookmarks, locations (list/map bbox/search/detail), saved locations, reports, admin (locations, content, moderation), password reset, account deletion, public profile view (`GET /users/{id}` or handle-based).
- **Pagination style** not chosen. [R] Cursor-based for feeds; offset acceptable for admin lists.
- **Auth mechanism** not chosen (D-04). The schema already has a `sessions` table with hashed tokens, which fits server-side sessions in HTTP-only cookies — [R] the simplest option for a same-site Vue SPA; requires CSRF protection (SameSite + token or Origin check).
- **OpenAPI workflow** not decided: spec-first with generated server types (e.g. oapi-codegen) and generated TS types, or code-first. [R] Spec-first with generated types on both sides, domain validation still hand-written — matches ADR-009. Decision D-05.

---

## 7. Background processing

- ADR-005: outbox + worker, no broker. [C]
- **[R]** For MVP, a single PostgreSQL jobs/outbox table polled with `FOR UPDATE SKIP LOCKED`, with attempts, backoff, `last_error`, and a dead state. One mechanism for both "event after commit" and "job to run".
- Needed by PQ-020 (media processing) and PQ-042 (AI). Must exist before PQ-020 → add as a Phase 0/early Phase 2 task (A-8).
- Every handler idempotent (re-processing an asset must not create duplicate variants; re-running an analysis must not double-charge usage).

---

## 8. Media pipeline — technical points not yet in the docs

1. **Orientation:** apply EXIF `Orientation` to pixels *before* stripping metadata, otherwise portrait photos display rotated.
2. **Colour profile:** keep/convert ICC (convert to sRGB for web) while stripping everything else; stripping ICC from wide-gamut images shifts colours — visible to photographers.
3. **Decompression bombs:** enforce pixel-count limit *before* full decode (docs mention max dimensions [C]).
4. **Image library choice** (D-07): libvips bindings (fast, low memory, cgo + system dependency in Docker) vs pure-Go libraries (simple build, slower, higher memory, weaker format support). HEIC needs libheif either way — defer HEIC [C `media-and-exif.md`].
5. **Upload path** (D-03 sub-decision): presigned direct-to-bucket uploads (scalable; needs bucket CORS, completion verification) vs proxied through API (simpler, limits on body size/timeouts). [R] Either is fine for pilot volumes; presigned matches the documented flow.
6. **AI derivative** must be sanitised too (no GPS sent to provider) [C coach spec: no precise location].
7. **Deletion** must remove all variants from storage (ADR-014) — needs a cleanup job.

---

## 9. Security & privacy review

- Password hashing: "reputable algorithm" [C]; [R] argon2id or bcrypt — choose in PQ-010.
- Rate limits for auth, uploads, AI [C]; [R] in-process limiter is sufficient for single-instance deploy; document that it is per-instance.
- Media access via short-lived signed URLs or authenticated proxy [C]. Public derivatives of public posts can be served from a CDN-able path; private originals never.
- Logging rules [C] — add: never log EXIF GPS or full storage keys.
- **Legal/data residency** (R-07 in risks doc): pilot users are in Russia; storage location of personal data and cross-border transfer of photos to an AI provider must be checked before launch.

---

## 10. Frontend review (`docs/frontend/architecture.md`)

- Stack and FSD guidance are appropriate. [C]
- Routes must be extended for feed, post detail, location map/list/detail, library (saved), public profile, admin.
- **Map component** behind a thin adapter in `shared/` (the provider will be chosen in D-06).
- **i18n** must be decided at PQ-002 (D-10); retrofitting is costly.
- **API types:** generated from OpenAPI into `shared/api` [R].
- **Image display:** responsive `srcset` from variants; needs a variant naming contract with the backend.

---

## 11. Infrastructure

- Local: Docker Compose with PostgreSQL + S3-compatible local storage [C].
- **Deployment target is unspecified.** PQ-052 needs backups and monitoring, cookies need a domain topology, storage needs a provider. [A] A single VPS running Compose (API, worker, Postgres or managed Postgres, object storage provider) would match the "boring technology" principle; this is not a decision. D-03/D-11.
- CI: GitHub Actions [C]. Image library choice affects CI (cgo deps).

---

## 12. Recommended ADRs and doc updates

> Numbering note (2026-11-03): the ADRs actually created use different numbers — ADR-018 scope, ADR-019 public access/authorization, ADR-020 post-location ownership, ADR-021 Shooting Details value type, ADR-022 jobs/outbox, ADR-023 storage adapter, ADR-024 i18n, ADR-025 moderation. Decisions still open (auth mechanism, image library, map provider, AI provider) get the next free numbers when decided.

**New ADRs needed (original proposal, topics only):**
- MVP scope and product direction (D-01)
- Authentication and session mechanism (D-04)
- Object storage provider and upload path (D-03)
- Image processing library and supported formats (D-07)
- Map/geocoding provider (D-06)
- AI provider and data-sharing terms (D-02)
- Jobs/outbox implementation
- Shared Shooting Details value type (if §4.2 accepted)
- Localisation (D-10)

**Docs to update after D-01** (documentation-only change, no code): `CLAUDE.md` §2/§5, `README.md`, `overview.md` (module list, schemas), `modules.md` (A-5), `database-schema.md` (A-2, §5), `api-contracts.md` (A-3, §6), `frontend/architecture.md` (A-4), `user-flows.md` (discovery flows, onboarding), `media-and-exif.md` (A-6, §8), ADR-004/011/013 wording ("future Community").

No original document was modified in this review.
