# Decision Review — Nine Topics Before Final Approval

- **Date:** 2026-11-03
- **Revision:** 4 — **approved by the owner on 2026-11-03.** Revision 2 added the owner's second-round decisions; revision 3 added handle rules, the revocation design, the location privacy model, merge resolution, complete decision lists and the approval checklist; revision 4 merges the approved proposals R4-1 to R4-5 with the owner's clarifications and fixes four errors in revision 3 (§0).
- **Type:** Decision record. The documentation changes listed in §12 were applied in the documentation synchronization recorded in `documentation-sync-2026-11-03-r4.md`.
- Tags: **[C]** confirmed in current docs · **[A]** assumption · **[R]** recommendation.

Each topic has three parts:
- **Accepted decision** — decided by the owner.
- **Approved technical details** — implementation-level design approved with revision 4; values marked [A] are defaults that the implementing task may tune and document.
- **Future considerations** — not in the MVP; listed so today's design does not block them.

---

## 0. Revision 4 changes and errata

Approved changes merged in this revision:

| ID | Change | Section |
|---|---|---|
| R4-1 | Equipment merges are edges; aliases never move; exact undo; **maximum chain depth enforced when a merge is created**; tests for long chains, cycles, brand merges and undo | §2.2 |
| R4-2 | The selected location mode limits **all** public geographic information; approximate mode publishes only an area; **free-text location labels are public only in exact mode** | §8.2 |
| R4-3 | Exact time-bucket algorithm; cache headers; accurate revocation wording; provider checks in PQ-007; **emergency rotation explicitly disables the old signing credentials** | §7.3 |
| R4-4 | Accurate terminology: transactional job queue with in-process events; no persistent event history | §1.1 |
| R4-5 | Pilot built as vertical slices S0–S5 with task splits; **staging restricted to invited testers, not indexed, no public registration; test-data and consent rules before S5** | §6.3 |

Errata fixed (revision 3 → 4):
1. The header said documentation changes were "listed in §11"; they are in **§12**.
2. §7.1 referred to "(7.4)" for signed URLs and caching; the correct reference is **§7.3 e–f**.
3. §8.2 a/b still used the old location visibility value `public`; the field is now `mode` with values **`exact`**, `approximate`, `private`.
4. §1 called the design a "transactional outbox" without stating that no event history is stored; corrected in §1.1.

---
## 1. Background jobs (transactional job queue)

### 1.1 Accepted decision
- **One PostgreSQL jobs table** (`platform.jobs`).
- Jobs are inserted in the **same database transaction** as the domain change that causes them.
- The design documents idempotency, unique event-handler jobs, lease expiration, retries, stale workers, failed jobs and manual retry (below).

**Terminology (R4-4).**
- The design is a **transactional job queue**: handler jobs are inserted in the caller's transaction, so a job exists if and only if the domain change committed. This provides the reliability guarantee of the transactional-outbox pattern.
- **Domain events are in-process values only.** `events.Publish(tx, event)` immediately turns an event into one job row per registered handler inside the caller's transaction; **the event itself is not stored**.
- Consequences, accepted for the MVP: no persistent domain-event history and no replay; an event without handlers leaves no trace; a handler added later does not receive past events; completed jobs are deleted after a retention period, so the jobs table is not an audit trail. Admin actions are recorded in `platform.audit_log`, product analytics in the analytics events table.
- If a stored event history is needed later, an `outbox_events` table can be added behind the same `events.Publish` API.

Why one table (from revision 1): every MVP job has a single consumer; a separate outbox and relay would add a second table, a relay loop and a second idempotency point without benefit at pilot scale.
### 1.2 Approved technical details

**a) Table shape (additions to the current logical model)**
`id`, `kind`, `payload` (IDs only — see f), `dedupe_key`, `status` (`pending`, `running`, `succeeded`, `dead`), `run_after`, `attempts`, `max_attempts`, `lease_token` (UUID, nullable), `locked_until`, `last_error` (sanitised), `last_error_class` (`transient`, `permanent`), `manual_retries`, `created_at`, `updated_at`, `finished_at`.
Unique index on (`kind`, `dedupe_key`).

**b) Unique event-handler jobs**
- Modules publish domain events inside their transaction: `events.Publish(tx, event)`.
- Each event has an `event_id`. Where a business action could be repeated (client retries, double submits), the ID is **deterministic** from the business fact, e.g. `post:{postId}:published:{publishVersion}`; otherwise a fresh UUID.
- An in-process dispatcher (handlers registered at bootstrap) inserts **one job per registered handler**, `kind = handler name`, `dedupe_key = event_id`, using `INSERT … ON CONFLICT DO NOTHING`.
- Result: a given event creates **at most one job per handler**, even if the producer publishes it twice. Producers never reference consumers directly.
- Direct enqueue (`jobs.Enqueue(tx, kind, dedupeKey, payload)`) remains for simple one-consumer work such as `media.process_asset:{assetId}:{generation}`.

**c) Claiming and lease expiration**
- A worker claims a batch in a short transaction with `FOR UPDATE SKIP LOCKED`, setting `status='running'`, a fresh random `lease_token`, `locked_until = now() + lease`, `attempts = attempts + 1`.
- Eligible rows: `pending` with `run_after <= now()`, **or** `running` with `locked_until < now()` (lease expired → the previous worker is presumed dead).
- The handler runs **outside** the claim transaction, so no row lock or transaction stays open during long work (AI calls, image processing).
- Handler timeout is shorter than the lease (per job kind; e.g. 2 min timeout, 5 min lease [A]). Long jobs may extend the lease with a heartbeat (`UPDATE … SET locked_until = … WHERE id = $id AND lease_token = $token`); optional in MVP.

**d) Stale workers (fencing)**
- Every completion or failure update includes `WHERE id = $id AND lease_token = $token`.
- A worker whose lease expired (and whose job was re-claimed by another worker) updates **0 rows**; it logs "stale completion discarded" and stops.
- Because a stale and a fresh worker can briefly run the same job concurrently, **all handlers must be idempotent** (see e). This is the at-least-once guarantee; exactly-once is never assumed.

**e) Idempotency rules for handlers**
- Payload contains only IDs; the handler reloads current state, so a rerun sees the latest data.
- Deterministic outputs: storage keys derived from (`asset_id`, `variant kind`, `key_version`); metadata rows are upserts.
- State guards via conditional transitions: `UPDATE … SET status='ready' WHERE id=$id AND processing_generation=$gen`; "if already succeeded, return".
- Costly external calls (AI): the analysis row moves `queued → running` with a conditional update before the provider call; results are written conditionally; **allowance is consumed at most once per analysis** (conditional update keyed by analysis ID). A rare duplicate provider call after a lease expiry is possible, is logged, and never double-charges the user.

**f) Retries**
- Handlers return a classified error:
  - `transient` (timeouts, storage/provider 5xx or 429) → `status='pending'`, `run_after = now() + min(base·2^attempts, cap) + jitter` (e.g. base 10 s, cap 1 h [A]).
  - `permanent` (unsupported file, corrupt image, invalid input) → final failure immediately, no retries.
- `max_attempts` per kind (e.g. media 5, AI 3, file deletion 10 [A]).
- `last_error` never contains secrets, signed URLs, storage keys or coordinates.

**g) Failed jobs**
- After the final attempt (or a permanent error) the job becomes `dead`, and **in the same transaction** the handler's `OnFinalFailure` updates domain state: asset → `failed` with a user-safe code; analysis → `failed` and its allowance reservation released. Users never see an endless "processing".
- Monitoring (pilot requirement): count of `dead` jobs, age of the oldest `pending` job, and job error rate are exposed to the monitoring setup with an alert threshold.

**h) Manual retry**
Two distinct mechanisms:
- **Operator requeue** of a `dead` job: admin-only API endpoint and/or CLI command sets `status='pending'`, `run_after=now()`, increments `manual_retries`, grants a fixed number of extra attempts, clears the lease; writes an audit-log entry. Pilot: CLI/admin endpoint is enough; an admin screen is an MVP extension.
- **User-initiated domain retry** (e.g. "Retry processing" on a failed upload): does not revive the old job; it increments the asset's `processing_generation` and enqueues a **new** job with a new dedupe key. The old dead job stays as history.

**i) Housekeeping**
- Idle polling about every second; LISTEN/NOTIFY not needed.
- `succeeded` rows deleted after 14 days [A]; `dead` rows kept until requeued or dismissed by an operator.
- Periodic work (abandoned-upload cleanup, stuck-asset reconciliation, draft expiry) is scheduled by a worker ticker that enqueues jobs with a per-period dedupe key (e.g. `cleanup:incoming:2026-11-03T10`).

**j) Hand-rolled vs library**
Default: **hand-rolled**, because it is exactly the accepted one-table design. A third-party Postgres queue library usually brings its own schema (often several tables) and driver constraints; adopting one would be a deviation requiring explicit approval in the PQ-006 plan.

### 1.3 Future considerations
- If fan-out grows or an event history becomes useful (analytics replay, audit), add a separate `outbox_events` log later; the dispatcher API stays the same.
- Partitioning or a dedicated queue only if throughput requires it.

---

## 2. Equipment data model

### 2.1 Accepted decision
- Canonical **brands** and **models**, **aliases**, and **provisional models**.
- **Original EXIF strings and user-entered names are preserved.**
- **Provisional models never become verified automatically** — only by an admin action.
- Future **merging** of models must not lose historical data.
- No large external catalog; a small hand-curated seed list.

### 2.2 Approved technical details

**a) Tables**
```
equipment.brands          id, canonical_name, slug, status (verified|provisional),
                          merged_into_id (nullable), created_source, verified_by, verified_at
equipment.brand_aliases   alias_key UNIQUE → brand_id (immutable), source (seed|exif|user|admin), first_seen_text
equipment.models          id, kind (camera|lens), brand_id, canonical_name, slug,
                          status (verified | provisional),
                          merged_into_id (nullable — direct merge target, never rewritten by later merges),
                          attributes JSONB (mount, fixed_lens, focal range, max aperture — optional),
                          created_source (seed|exif|user|admin), verified_by, verified_at
equipment.model_aliases   (kind, alias_key) UNIQUE → model_id (immutable),
                          source, first_seen_text
                          alias_key = normalised brand text + "|" + normalised model text, e.g. "nikon|z 6ii"
equipment.model_merges    id, source_model_id, target_model_id, merged_by, merged_at, note,
                          undone_by, undone_at
equipment.brand_merges    same shape for brands
equipment.user_equipment  id, user_id, model_id, entered_brand_text, entered_model_text,
                          nickname, is_primary
```
There is no `merged` status value: "is merged" means `merged_into_id IS NOT NULL`; the model keeps its own `verified`/`provisional` status.

**b) Preserving original names**
- `media.extracted_metadata.raw_allowlist` keeps the original EXIF strings (Make, Model, LensMake, LensModel, Software) exactly as found.
- Shooting Details snapshots store, per equipment field: `*_raw_text` (what EXIF or the user provided), `*_model_id` (resolved model, nullable), and provenance.
- `user_equipment` keeps `entered_*_text` exactly as typed.
- Display rule: the effective model's canonical name if it is **verified**; otherwise the original text. The expanded Shooting Details view always shows the original text.

**c) Resolution flow**
1. Normalise brand and model text (lowercase, trim, collapse whitespace and punctuation, drop corporate suffixes such as "corporation" or "co., ltd.", drop a repeated brand prefix) and build the `alias_key`.
2. Look up the model alias → model → follow `merged_into_id` to the effective model (d).
3. Miss → create a **provisional** brand (if needed), model and alias in one transaction (`ON CONFLICT` handles concurrent creation). The same normalised spelling always resolves to the same model, so exact-spelling duplicates never appear.
4. No fuzzy matching in the MVP. Different spellings remain separate provisional models until an admin merges them or adds the spelling as an alias of an existing model.

**d) Verification (never automatic)**
- `provisional → verified` only through an admin action, audit-logged, recording `verified_by/at`.
- Usage counts or heuristics may **suggest** candidates to admins, never verify.

**e) Merges as edges, exact undo (R4-1)**
- **Aliases never move**; an alias always points at the model it was first resolved to. An admin may delete a wrong alias (audit-logged); that is the only alias mutation besides creation.
- **A merge S → T sets only `S.merged_into_id = T`.** No other model or alias is touched; earlier merges into S stay as they are, so chains such as A → S → T are allowed.
- **Effective model** = follow `merged_into_id` until a model without it.
- **Maximum chain depth D = 5 [A], enforced when a merge is created** (owner clarification): the merge S → T is rejected if `depth(longest chain ending at S) + 1 + depth(chain from T to its effective model) > D`. Resolution uses the same limit as a defensive guard and raises an alert if it is ever exceeded (which would indicate a bug or a manual data change).
- **Cycles are rejected at merge time:** S → T is refused if S = T or if T's chain already contains S.
- Merge creation runs in one transaction that locks the involved model rows (`SELECT … FOR UPDATE`), so two concurrent merges cannot together create a cycle or exceed the depth.
- **Undo** of S → T sets `S.merged_into_id = NULL` and fills `undone_by/at` in the merge log. Allowed only while `S.merged_into_id = T`. After undo, A → S still holds, so A resolves to S again — exactly the state before the merge.
- **Brand merges** use the same edge pattern (`brands.merged_into_id`, `brand_merges`, same depth and cycle rules). Because alias keys contain brand *text*, not brand IDs, a brand merge changes no alias and no model row; display resolves the model's brand through the brand chain.
- **Never changed by merges, undos or verifications:** snapshots (`*_raw_text`, `*_model_id`, provenance), `user_equipment`, `media.extracted_metadata.raw_allowlist`, and the merged model's own row (except `merged_into_id`).
- MVP tooling: admin API endpoints for merge, undo and verify; an admin screen is an MVP extension.

**f) Search and filtering**
- Equipment exposes `ResolveEffective(modelIDs) → effective model per ID` and `ModelsResolvingTo(T) → {T} ∪ {every model whose chain ends at T}` (recursive query over `merged_into_id`, bounded by D).
- Community filters on its own snapshot table: `camera_model_id IN (ModelsResolvingTo(T))`; no cross-module joins.
- Filter options: distinct snapshot model IDs of published posts → `ResolveEffective` → grouped by effective model. Merged models never appear as separate options; provisional models appear only if used, labelled "unverified" [R].
- After an undo the results change back automatically; nothing is rewritten or re-indexed.
- If needed later, a derived `effective_model_id` cache column on `equipment.models` can be refreshed after each merge/undo; it is a cache, not history.

**Required tests (R4-1):**
- Merge S → T: filter by T returns posts of S and T; snapshot text and IDs unchanged.
- Chain A → S → T resolves A to T; undo S → T restores A → S.
- **Long chains:** a chain of exactly D is accepted and resolves; a merge that would make it D + 1 (from either end) is rejected.
- **Cycles:** S → S rejected; S → T when T → … → S rejected; concurrent merges S → T and T → S cannot both succeed.
- **Brand merges:** no alias or model row changes; models display the effective brand; brand undo restores display.
- **Undo:** only the merge currently in effect can be undone; undo is idempotent; merge log records both events.
- Resolution of new input after merge and after undo.

**g) Special cases**
- Phones and fixed-lens cameras: `attributes.fixed_lens = true`; lens text is kept as raw text but no separate lens model is required.
- Adapted/manual lenses with no EXIF lens data: lens field stays empty unless the user adds it.
- Serial numbers are never extracted or stored (also §7).

**h) Abuse control**
Length and character limits on user-entered names; provisional entries reportable through Moderation; no public listing of unused provisional models.

### 2.3 Future considerations
- Fuzzy-match suggestions for admins; bulk verification tools.
- Rich attributes (sensor size, crop factor → 35 mm-equivalent focal length) for Gear Explorer.
- Optional import of a licensed catalog later; aliases make it additive.

---

## 3. Location management

### 3.1 Accepted decision
- **Admin-curated locations only** for the initial pilot.
- Future **user-submitted suggestions** and **external imports** must remain possible without major architectural changes.
- Nothing of these future features is implemented now.

### 3.2 Approved technical details
- [R] Add a `source` column to `explore.locations` with the single value `editorial` in the PQ-030 migration. Cost: one column; benefit: no backfill when suggestions/imports arrive.
- Location status remains `draft/published/archived`; future states (e.g. `suggested`, `rejected`) are added as new values or kept in a separate suggestions table — both are additive.

Why no major change is needed (from revision 1):

| Future feature | Additive change | Ownership impact |
|---|---|---|
| User suggestions | `explore.location_suggestions` + Explore use case `ApproveSuggestion` + Moderation reports | None |
| "Suggest from my photo point" | Explore reads an author point via a Community interface, with author consent | None |
| External imports | `explore.location_external_refs` (provider, external_id, licence, last_synced_at) + import job kind | None |
| Localised names | Translation table when English launches | None |

### 3.3 Future considerations
- Licence review per data source before any import (some open datasets carry attribution and share-alike obligations [A]).
- Dedupe step (name similarity + distance) when approving suggestions/imports.
- Safety/precision review for sensitive places.

---

## 4. AI Photo Coach

### 4.1 Accepted decision
- A **standalone AI Photo Coach** analyses **the user's own photo — draft or published**.
- It **does not depend on Learning or Challenges**.
- Learning content **can provide** additional context and rubrics.
- **Challenge feedback** is added later using the **same AI engine**.
- **AI feedback is private by default.**
- AI Coach must **not delay the first pilot** (see §6).

### 4.2 Approved technical details

**a) Subject model**
`coach.analyses` references a **subject** instead of a submission:
`subject_type` (`post` now; `submission` later), `subject_id`, `media_asset_id`, `user_id`, `context` JSONB, `input_fingerprint` (hash of the Shooting Details/caption sent), provider/model/prompt version, status, usage, latency, error code.

**b) Contexts**
- `general` (MVP): user chooses a **focus** — composition, light & exposure, technical quality, or overall — plus an optional question/intent.
- `challenge` (later): challenge objective + challenge rubric, supplied by Content/Learning through an interface.

**c) Rubric ownership** [R]
Coach owns a small set of **general focus rubrics**, versioned together with the prompt version, so Coach works with no Learning or Content data at all. Content may later **provide** challenge rubrics through an optional interface. Dependency direction: Learning/Content → Coach (caller), never Coach → Learning.

**d) Authorization**
The request goes through Community: Community checks that the viewer owns the post (draft or published, including a post hidden by moderation), then calls Coach with the asset ID; Coach obtains the `ai_analysis` variant from Media. Coach never accepts a client-supplied asset ID on its own authority.

**e) Inputs sent to the provider**
The sanitised `ai_analysis` variant, focus, optional question, optional Shooting Details, experience level. **Never** location data, GPS, raw EXIF, email or other profile data.

**f) Privacy**
- Feedback is visible only to the photo's owner (and to admins only when handling a report about that feedback).
- MVP has **no** sharing option; "private by default" leaves room for a future opt-in share.
- Feedback is not shown on public post pages, not in feeds, not in analytics payloads.
- Deleting a post deletes its analyses' feedback text; usage counters keep only counts.

**g) Guardrails**
Critique photographic choices only; never comment on people's appearance or infer sensitive attributes; no scores; acknowledge uncertainty about intent. Output schema-validated before storage.

**h) Allowance and failure**
One allowance (`ai.coach.analyses_per_month`) across all entry points; reserve → consume once → release on failure (§1.2 e/g). A per-post cooldown to prevent repeated analyses of an unchanged photo (same `input_fingerprint`) [R].

**i) API**
`POST /posts/{postId}/analyses` [auth, owner] (body: focus, question) → analysis status; `GET /posts/{postId}/analyses` [auth, owner]; `POST /feedback/{feedbackId}/rating` [auth, owner].

**j) Feature flag**
The Coach is shipped behind a server-side feature flag so it can be enabled for pilot users when ready, without a redeploy of the pilot gate.

### 4.3 Future considerations
- Challenge context (same engine).
- Optional sharing of feedback by the owner.
- "How could I make a photo like this?" on other users' photos (needs separate privacy and attribution rules).
- Comparison of two of the user's own photos; progress over time.

---

## 5. Public profiles and privacy

### 5.1 Accepted decision
Separate per-field visibility settings; **no single "private profile" switch**. Identical rules for anonymous and signed-in viewers.

| Field | Visible to others | Default | User can change |
|---|---|---|---|
| Username | Public | Public | No (always public) |
| Display name | Public | Public | No (always public; may be a pseudonym) |
| Avatar | Public (if set) | Public | Can remove the avatar |
| Published photos | Public | Public | Only by deleting/unpublishing; per-photo location mode applies |
| Biography | Toggle | **Private** | Yes |
| Equipment | Toggle | **Public** | Yes, can hide |
| Instagram link | Toggle | **Private** | Yes |
| Experience level | — | **Private** | MVP: always private |
| Drafts, saved items, email, AI feedback | Never | Private | No |

### 5.2 Approved technical details

**a) Public handles (approved)**

The handle is a unique public identifier, separate from the display name. Display names may be in any script, need not be unique, and identify nobody on their own.

| Rule | Proposal |
|---|---|
| Characters | Lowercase Latin letters `a–z`, digits `0–9`, underscore `_`. ASCII only, to prevent look-alike impersonation (e.g. Cyrillic «а» vs Latin "a") and to keep URLs clean. Display names can be Cyrillic. |
| Length | 3–30 characters [A] |
| Shape | Starts with a letter; no leading/trailing underscore; no double underscore |
| Normalisation | Input lowercased before validation and storage; uniqueness is therefore case-insensitive |
| Uniqueness | Unique across **active handles and reserved old handles** (see below) |
| Reserved words | Route and system names (`admin`, `api`, `explore`, `login`, `register`, `settings`, `me`, `u`, `photos`, `locations`, `library`, `publish`, `help`, `support`, `about`, `terms`, `privacy`), brand/staff terms (`photoquest`, `moderator`, `official`, `team`) and a short profanity list. Maintained as seed data. |
| When chosen | At registration, with an availability check and suggestions; availability checks are rate-limited |
| Moderation | Reportable (`target_type = profile`); an admin can force a handle change (audit-logged) |

**Can users change their handle?** Yes, with a **cooldown of 30 days** between changes [A]. No limit on the total number of changes beyond the cooldown in the MVP.

**Old profile URLs**
- `profiles.handle_history`: `handle` (unique), `user_id`, `retired_at`.
- Public lookup `GET /api/v1/profiles/{handle}`: if `handle` is current → profile; if it is in history for an active user → `{ "redirect_to": "<current handle>" }`, and the SPA replaces the URL (`/u/old` → `/u/new`). Search engines and shared links keep working.
- Internal references always use `user_id`. Post URLs use post IDs (`/photos/:postId`), so **handle changes never break photo links**.

**Are old handles reserved?** Yes — **old handles are never reassigned to another user in the MVP**. This prevents impersonation via previously shared links and keeps redirects permanent. The original owner may switch back to one of their own old handles.
- Deleted accounts: the handle stays reserved but is detached from any personal data (a plain reserved-handle record); its URL returns "not found", not a redirect. Disclosed in the privacy policy.
- Disabled or moderation-hidden accounts: handle retained; profile returns "not found".
- Revisit reservation length (e.g. release after N years) only if namespace pressure appears.

**b) Visibility columns and UX**
- `bio_visibility` (default `private`), `gear_visibility` (default `public`), Instagram `visibility` (default `private`); experience level has no visibility column in MVP.
- UX to avoid confusion with private defaults: when the user fills in bio or adds Instagram, the field shows "only you can see this" with the toggle right next to it.
- Equipment toggle hint: "your photos' Shooting Details still show the camera and lens used".
- Profile states: disabled, deleted or moderation-hidden account → 404 for everyone and their posts are no longer listed; no published photos → empty state.
- Never collected in MVP: home city or any profile-level location.
- Search-engine indexing of profiles: decided with D-18; not promoted during the pilot.

### 5.3 Future considerations
- Optional public experience-level badge.
- Per-viewer audiences (followers only) when Community features exist.
- Verified-photographer markers.

---

## 6. MVP size and pilot readiness

### 6.1 Accepted decision
- Scope is separated into **Pilot essentials**, **MVP extensions** and **Future features**.
- The first pilot prioritises discovery, photo publishing, Explore, Shooting Details, basic moderation and privacy.
- **AI Coach and Learning do not delay the first pilot.**
- **Backups, security and basic operational monitoring are mandatory pilot requirements.**

### 6.2 Final split

**Pilot essentials** (the pilot cannot start without them)

| Area | Items |
|---|---|
| Foundation | Skeleton with Russian i18n, local env, CI, platform baseline, jobs + worker (§1 incl. manual requeue via CLI/admin endpoint), storage adapter |
| Accounts | Registration/login/logout, password reset (manual admin fallback if no email channel), account deletion, roles and authorization |
| Profiles | Username, per-field visibility (§5), skippable onboarding, avatar, Instagram link |
| Equipment | Canonical resolver, provisional models, small seed list, user gear (§2) |
| Media | Full lifecycle (§7) |
| Photos | Draft → Shooting Details review → publish; public photo page; public feed; photo bookmarks |
| Explore | Admin location management (simple forms), map and list, location pages, photo–location link with three modes (§8), saved locations, Library |
| Search | Locations by name/category/viewport; photos by location, camera, lens |
| Moderation | Reports, hide/unhide, audit log |
| Privacy & legal | Terms, privacy policy, upload licence, consent; GPS and location privacy tests |
| **Security** | HTTPS; secure session handling and CSRF protection (per D-04); password hashing; rate limits (auth, uploads, reports, public endpoints); upload validation; authorization tests for anonymous/owner/other/admin; secrets in environment; least-privilege storage credentials, no public bucket listing; security headers incl. CSP; dependency vulnerability scanning in CI (tools chosen in D-17) |
| **Backups** | Automated daily database backups stored off the main server; object-storage protection (versioning or replicated backup); retention policy; **tested restore** |
| **Monitoring** | Uptime check, error-rate alerting from structured logs, job-queue health (dead jobs, oldest pending), disk/DB/storage usage, backup-success alert |
| Measurement | Analytics event capture; basic pilot metric queries |
| Readiness | E2E tests of critical journeys (anonymous browse, discover a location, inspect Shooting Details, publish with a location mode, save, report); seed content loaded |

**MVP extensions** (part of the MVP; can ship during the pilot)
- AI Coach standalone: allowance (PQ-043) → standalone Coach on own drafts/published posts (PQ-042a), behind a feature flag.
- Learning: seeded paths/lessons/challenges (PQ-040), challenge submissions (PQ-041), challenge context in Coach (PQ-042b).
- Admin equipment merge/verification screen (SQL/endpoint is enough before).
- Admin dead-job screen (CLI/endpoint is enough before).
- Extra filters (focal length, aperture), collections.
- Link previews / server-rendered meta (D-18).
- EXIF-GPS location suggestion when publishing (D-08).
- Email notifications beyond password reset.

**Future features** (not MVP)
Comments, reactions, follows, groups, messaging, events; user-submitted locations and imports; routes and forecasts; multiple location roles per photo; AI on other users' photos; sharing AI feedback; publish-from-submission; Pro plans and payments; Academy; Instagram API; Gear Explorer; English locale and translated content; native apps; recommendations.

### 6.3 Approved technical details — vertical slices (R4-5)

Same pilot scope and tasks, built as incremental vertical slices; each slice ends with a working end-to-end journey.

| Slice | Journey validated at the end | Tasks |
|---|---|---|
| **S0 Walking skeleton** | API, worker and Russian frontend shell run locally and in CI | PQ-002, PQ-003, PQ-004, PQ-005 |
| **S1 Publish and view one photo** | Signed-in user uploads a JPEG, reviews extracted Shooting Details (raw text only), publishes; anonymous visitor opens the photo page; privacy tests prove no metadata/GPS in variants | PQ-006, PQ-007, PQ-010a, PQ-013, PQ-020a, PQ-021a, PQ-022; PQ-054a staging |
| **S2 Browse and profile** | Feed, bookmarks, public profiles by handle, per-field visibility | PQ-023, PQ-011 |
| **S3 Find a place** | Admin locations, map/list, place pages, photo–location modes, saved places, Library | PQ-030, PQ-031, PQ-032, PQ-033 |
| **S4 Gear and search** | User gear; canonical/provisional resolver with backfill of earlier snapshots from preserved raw text; search and filters | PQ-012, PQ-021b, PQ-034 |
| **S5 Safe for real people** | Reports and hide; terms and consent; password reset and account deletion; remaining formats, cleanup and reconciliation; analytics capture; production with backups and monitoring | PQ-050, PQ-053, PQ-010b, PQ-020b, PQ-014, PQ-054b |
| **Pilot gate** | Full E2E journeys; pilot metric queries; seed content | PQ-051, PQ-052 |

Task splits: PQ-010a/b (core auth / reset and deletion), PQ-020a/b (JPEG core / remaining formats, cleanup, reconciliation), PQ-021a/b (value type and review / equipment resolver and backfill), PQ-054a/b (staging / production, backups, monitoring).

**Staging and pre-S5 testing rules (owner clarification)**
- **Access:** staging is reachable only by invited testers. Public registration is disabled; accounts are created by an admin or with single-use invite codes. Staging additionally sits behind an access gate in front of the whole site (e.g. HTTP basic auth or an IP allowlist at the reverse proxy [A]), so that public photo and location pages — which are anonymous by design — are not reachable by the public.
- **No search-engine indexing:** `X-Robots-Tag: noindex, nofollow` on every response (HTML, API and images where the provider allows response headers), a `robots.txt` disallowing everything, and `<meta name="robots" content="noindex">` in the SPA shell. The access gate is the real protection; the noindex signals cover the case where it is misconfigured.
- **Separate environment:** separate database, storage bucket, credentials and secrets from production; staging data is never copied to production and production data is never copied to staging.
- **Test data and consent until S5 is complete:**
  - Preferred: photos owned by the developer, or photos whose authors gave explicit written permission (e.g. a message or email) for use in testing.
  - Testers are adults known to the developer, informed in writing before access that the environment is a test system, what is stored (account email, uploaded photos, Shooting Details, locations), who can see it (other invited testers and the operator), that data may be deleted at any time, and that it is deleted when testing ends; their acknowledgement is recorded.
  - Testers are asked to upload only their own photos, **without identifiable people** and **without locations near homes, workplaces or other private places**, and to prefer "approximate" or "private" location modes.
  - No real personal data beyond the testers' own accounts; no production users; no photos of minors.
  - Staging data is wiped (database and bucket) before the pilot and whenever the consent basis changes; a reset command is documented in setup.
  - Legal pages, consent flows and moderation are completed in S5 (PQ-053, PQ-050); the R-07 legal review applies to the pilot, not to this closed test, but data minimisation applies throughout.
- **No public or wider pilot access before S5 is complete.** Moderation, terms, backups and monitoring remain mandatory pilot requirements.
- Hosting (D-11) is therefore needed during S1 for the staging deploy (PQ-054a).

### 6.4 Future considerations
Pilot learnings decide the order of extensions; Learning introduced mid-pilot gives a before/after retention signal.

---

## 7. Media lifecycle

### 7.1 Accepted decision
The proposed lifecycle is accepted, with these binding rules:
- **Original files remain private.**
- **Public variants are generated independently and sanitised.**
- **GPS is never exposed through public metadata or API responses.**
- Hidden and deleted posts have defined effects on image access (7.3).
- Signed URL expiry, CDN caching and revocation are defined (§7.3 e–f).
- **Colour management and image orientation are preserved.**

### 7.2 Lifecycle (summary)

| Stage | What happens |
|---|---|
| 1. Upload intent | Purpose, declared size/type checked; asset `pending_upload`; draft post created for purpose `post`; upload target issued |
| 2. Temporary storage | Object written to `incoming/{assetId}` in the private bucket; abandoned uploads and `pending_upload` assets removed after ~24 h by a cleanup job (and a bucket lifecycle rule if available) [A] |
| 3. Completion | Idempotent; server verifies existence, actual size, file signature; failure → asset `failed`, object deleted; success → copied to `originals/{assetId}`, `incoming/` deleted, asset `uploaded`, `media.process_asset` enqueued in the same transaction |
| 4. Metadata extraction | Allowlist only (make, model, lens, focal length, aperture, exposure time, ISO, exposure bias, flash, capture time + offset, software); raw allowlisted strings preserved (§2); GPS handled per D-08; never stored: serial numbers, artist/owner fields, MakerNotes, XMP/IPTC location fields |
| 5. Processing | Pixel limit checked before decode; orientation applied; colour converted; variants written; asset `ready` |
| 6. Review | Draft shows pre-filled Shooting Details with provenance; user edits; optional location with an explicit mode |
| 7. Publication | One transaction: asset `ready`, terms accepted → post `published`; private GPS suggestion (if any) deleted; `PostPublished` event |
| 8. Delivery | Owning module authorises, Media issues URLs (§7.3 e–f) |
| 9. Failure | Transient → retry; permanent/final → asset `failed` with user-safe code; "Retry processing" (new generation) or upload another file; reconciliation sweep for stuck assets |
| 10. Deletion | See 7.3 |

### 7.3 Approved technical details

**a) Originals**
- Stored only under `originals/`; never addressed by any URL returned to clients; read only by the worker. No owner download in MVP.
- Kept to allow regenerating variants later (new sizes/formats).

**b) Independently generated, sanitised variants**
- Variants are produced by **decoding pixels and re-encoding** a new file — never by copying the original and deleting tags. This guarantees no residual EXIF, XMP, IPTC, comments, MakerNotes or **embedded thumbnails** (which can show the uncropped original).
- The only metadata written into a variant is a compact sRGB colour profile (or none, since browsers assume sRGB).
- Keys: `variants/{assetId}/{key_version}/{kind}` where `key_version` is random per generation (a regenerated set never reuses an old key, see e–f).
- **Privacy contract tests:** for every fixture (including files with GPS, XMP location, embedded thumbnails), parse each variant and assert no EXIF/XMP/IPTC/GPS segments.

**c) GPS never exposed**
- Not in variants (b), not in any API response (serializers use explicit field allowlists; post location fields follow §8 only), not in analytics, logs, job payloads, error messages or AI inputs.
- If D-08 keeps a GPS suggestion, it is visible only to the owner during editing and deleted on publish or after the draft expires.

**d) Orientation and colour**
- Apply the EXIF orientation (all 8 values, including mirrored ones) to pixels before encoding; the variant has no orientation tag.
- Read the embedded ICC profile; convert to **sRGB** (relative colorimetric or perceptual rendering intent — chosen in the PQ-020a spike); no profile → treat as sRGB; CMYK JPEGs converted; grayscale handled.
- Known limitation: HDR gain maps in modern phone photos are not preserved in the MVP.
- Fixtures: Display P3, Adobe RGB, CMYK, grayscale, all orientations.

**e) Image access revocation**

A presigned URL is a signed permission for **one object key**, valid until its expiry; the storage service does not consult our database. A URL therefore cannot be revoked by changing database state. Revocation is enforced by **removing the object the URL points to**.

Three different things (R4-3):

| Action | What it does | What it does not do |
|---|---|---|
| **Stop issuing URLs** (database state `hidden`/`deleted`) | Immediately: no API response contains a URL for that image any more | URLs already issued stay valid until `valid_until` |
| **Delete the stored object** (hide/delete job) | Once the job has run, every request to storage for that object fails, including requests with old URLs | Does not remove copies already delivered to viewers |
| **Browser cache on a viewer's device** | Not controlled by PhotoQuest | A cached copy can be shown again (e.g. back navigation) for up to `max-age` = 1 h; downloads and screenshots indefinitely |

**Design:**
1. **Hide (moderation):** one transaction marks the post `hidden` (no new public URLs from this moment) and enqueues a high-priority job that **deletes the public variants** (`display_*`, `thumbnail`). The **original** and the sanitised, non-public **`ai_analysis` variant are kept**. Owner and admins view the hidden photo through 5-minute, non-bucketed signed URLs to the `ai_analysis` variant — never the original. Admin views are audit-logged.
2. **Unhide:** regenerate public variants from the original under a **new random `key_version`**; old keys are never reused, so no old URL can come back to life.
3. **Delete (owner or account deletion):** mark `deleted`, enqueue deletion of the original and all variants.
4. **Normal public delivery:** time-bucketed signed URLs (f).
5. **Emergency revocation of all images** (operational runbook, not a feature), in this order:
   1. Create new least-privilege signing credentials and deploy them to the API.
   2. **Disable the old signing credentials** at the storage provider (deactivate the access key, or revoke its policy), which invalidates every URL signed with them.
   3. Verify with a previously issued URL that access is refused.
   4. Delete the old credentials after confirmation; record the incident in the audit log.
   Rotating without disabling the old key does **not** revoke anything; step 2 is mandatory. The runbook is rehearsed once on staging in PQ-054a.

**Wording used in the documentation and privacy policy:**
- Hiding or deleting a photo removes it from PhotoQuest immediately. The stored image files are deleted shortly afterwards, normally within about a minute — a monitored target, not a guarantee.
- After that, the image can no longer be downloaded from PhotoQuest, even with a previously shared link.
- Copies already delivered to other people's devices (browser cache, downloads, screenshots) cannot be recalled.

**Effect of post states on image access**

| Post state | Who can view | URLs issued | Public variants | Original + `ai_analysis` |
|---|---|---|---|---|
| Draft | Owner | Owner only, 5 min, not bucketed | Exist (not public) | Kept (draft expiry deletes all, e.g. 30 days [A]) |
| Published | Everyone | Time-bucketed (f) | Exist | Kept |
| Hidden by moderation | Owner (notice) and admins | Owner/admin only: `ai_analysis`, 5 min | **Deleted** | Kept |
| Unhidden | Everyone | Time-bucketed | Regenerated, new `key_version` | Kept |
| Deleted by owner | Nobody | None | Deleted | Deleted |
| Account deleted | Nobody | None | Deleted | Deleted |
| Location mode changed | Unaffected | Unchanged | Unchanged | Unchanged |

Backups may contain deleted data until they rotate; disclosed in the privacy policy.

**f) Signed URLs and caching**

Direct signed URLs from object storage; **no CDN in the pilot**.

Time-bucket algorithm for public variants of published, non-hidden posts — bucket length **B = 3600 s**, URL lifetime **L = 2B = 7200 s**:
```
t            = current UTC time in Unix seconds
bucket_start = floor(t / B) * B
signing_time = bucket_start                 // not "now"
expires_in   = L                            // e.g. X-Amz-Expires=7200 (SigV4)
valid_until  = bucket_start + L             // remaining validity at issue: (B, 2B] = 1–2 h
url          = presign(key, signing_time, expires_in, fixed query parameters and response headers)
```
- All requests in the same hour bucket get a **byte-identical URL**, so browsers reuse their cached copy.
- Determinism requires the same signing credentials and key, a fixed set and order of query parameters and response-header overrides, and signing time = `bucket_start`.
- Signing credentials are long-lived, least-privilege keys (read-only on `variants/`); temporary session credentials would invalidate URLs when they expire.

Cache headers:
- Public variants: `Cache-Control: private, max-age=3600` (≤ minimum remaining URL validity); `private` keeps shared caches from storing copies.
- Owner-only drafts, hidden-post views and submissions: non-bucketed URLs with a **5-minute** lifetime, `Cache-Control: private, no-store`.
- Client: if an image fails because a page was open longer than the URL lifetime, the SPA reloads that post's data once to obtain fresh URLs.

**Provider compatibility checks in PQ-007** (owner clarification — must pass before the provider is accepted):
1. Presigned URLs with a past signing time (`bucket_start`) are accepted until `bucket_start + L`.
2. Identical inputs produce byte-identical URLs.
3. A deleted object is immediately unreadable through previously issued URLs (read-after-delete consistency).
4. Response-header overrides (`Cache-Control`) or object metadata are honoured.
5. Disabling an access key immediately invalidates URLs signed with it.
6. Upload size enforcement option available (presigned POST policy or proxied upload; see g).

Rejected for the pilot: an API authorise-and-redirect request per image (many extra API calls per feed page), and a public-read prefix (no access control beyond deletion). If a CDN is added later: the cache key includes the signature, CDN TTL ≤ minimum URL validity, and hide/delete jobs also purge the CDN.

This resolves the delivery part of D-03; the storage provider itself remains open.

**g) Upload size enforcement**
With presigned PUT, size is only checked after upload (then deleted if too large). Presigned POST with a content-length policy (if the provider supports it) or a proxied upload enforce it during upload. Decision with D-03.

### 7.4 Future considerations
Wide-gamut (Display P3) variants with a profile for capable displays; AVIF output; HDR support; owner download of originals; CDN with purge integration; short undo window for deletion.

---

## 8. Photo–location relationships

### 8.1 Accepted decision
- **One primary location per photo** in the MVP.
- A **separate link entity with its own ID**.
- Future **multiple location roles** without redesigning the domain model.
- **Approximate location must not expose recoverable exact coordinates.**

### 8.2 Approved technical details

**a) Model**
```
community.post_locations
  id                    UUID PK
  post_id               FK → posts, ON DELETE CASCADE
  role                  'primary' (only allowed value in MVP; CHECK constraint)
  explore_location_id   nullable, ON DELETE RESTRICT (locations are archived, not deleted)
  point_lat/lng         nullable — exact author point; public only when mode = exact
  approx_level          nullable — 'area' | 'neighbourhood'
  approx_cell_id        nullable — grid cell identifier at that level
  approx_lat/lng        nullable — centre of that cell (derived)
  approx_cell_size_m    nullable — cell size used (stored so later config changes don't alter rows)
  label                 nullable — free text; public only when mode = exact
  mode                  exact | approximate | private
  point_source          manual | exif_suggestion_confirmed
  UNIQUE (post_id, role)
  CHECK (explore_location_id IS NOT NULL OR point_lat IS NOT NULL)
  CHECK (mode <> 'approximate' OR approx_cell_id IS NOT NULL)
```
- Future roles (`shooting_point`, `subject`, …): add values to the role check; `UNIQUE (post_id, role)` still holds. No redesign, no PK change.
- API v1 returns one `location` object (the primary). Multiple roles later → additive `locations` array.

**b) Location privacy model**

*Rule (R4-2):* **the selected mode is an upper bound on precision for all public geographic information attached to the photo** — author point, curated place, label, location-page listing, filters, counts and anything derived from them. One invariant is tested: no public output is finer than the selected mode.

| Mode | Public output | Place-page listing | Location filter | Label |
|---|---|---|---|---|
| **Exact** | Linked place (id, name) and/or author point (rounded to ~1 m) | Yes | Yes | Public |
| **Approximate** | **Only** an area (cell centre + size). No place id or name. | No | No | **Not public** |
| **Private** | No `location` field at all | No | No | **Not public** |

The owner always sees their own stored data (place link, exact point, label) in owner-only endpoints; admins see it only when handling a report about that location (audit-logged).

*Labels (owner clarification).* Free-text labels can contain addresses or place names, so a public label could bypass the selected mode. **Labels are returned publicly only in exact mode.** In approximate and private modes the label is stored but shown only to the owner. The location step explains this; labels remain reportable. No attempt is made to detect addresses in label text in the MVP — the mode rule alone guarantees the label cannot leak in non-exact modes.

*Location step in the UI (plain language):*
- **"Show the place: [place name]"** — exact mode, curated place only, no personal point. The common, low-risk choice for photos taken at public curated spots; keeps place pages full.
- **"Show only the general area"** — approximate mode; preview of the exact cell visible to others; level "area" by default, "neighbourhood" opt-in with the hint "in sparsely built areas this can point to a specific property".
- **"Don't show the location"** — private mode.
- Placing a personal point is a separate, explicit action; showing it publicly requires exact mode and a confirmation.

*How approximation works.*
- **Deterministic snapping to a metric-aware grid**: the exact point (or, without a point, the linked place's **public** coordinates) maps to the cell that contains it; the public value is the cell's centre and size. Every point in a cell gives the same output, so repeated requests, many posts or averaging reveal nothing finer than the cell.
- **No random jitter.**
- **The public precision is the coarser** of the chosen level and the linked place's own public precision.
- The exact point **never leaves the server** outside exact mode; no client-side blurring.
- Grid geometry: cells roughly square in metres (at ~55° N a degree of longitude is about 0.57 of a degree of latitude in distance). Implementation in the PQ-032 plan: a longitude step scaled per latitude band (no dependency) or a hierarchical cell library such as H3/S2 (a dependency requiring approval).

*Grid precision selection.* One size is not equally private everywhere (a ~1 km cell covers thousands of homes in a city but possibly one house in a dacha settlement). Density-aware sizing would need external population/building data, so the MVP uses **two fixed levels**: "area" (e.g. ~5 km [A], **default**) and "neighbourhood" (e.g. ~1 km [A], opt-in). Final sizes: D-20.

*Public API shapes:*
```jsonc
// exact
"location": { "mode": "exact", "place": { "id": "…", "name": "…" }, "point": { "lat": 55.0302, "lng": 82.9204 }, "label": "…" }
// approximate — area only
"location": { "mode": "approximate", "area": { "center": { "lat": 55.03, "lng": 82.92 }, "size_m": 5000 } }
// private → the "location" field is absent
```
`place`, `point` and `label` are each optional in exact mode and present only if the author provided them.

*Protection against indirect disclosure*

| Channel | Protection |
|---|---|
| Image files | Variants re-encoded without metadata (§7.3 b); originals never delivered |
| API fields | Allowlisted serializers per mode; owner-only fields only in owner endpoints; privacy contract tests |
| Geographic filters, sorting, clustering, map viewport, counts | Computed **only from the public representation** (exact mode: place/point; approximate: cell; private: excluded) |
| Place pages, place filters and "N photos here" counts | Exact-mode links only |
| Labels | Public only in exact mode |
| Auto-generated place names | None in MVP; if added later, from the public representation only, never by reverse-geocoding an exact point |
| Mode changes | Take effect immediately for new responses; data already seen cannot be recalled (stated in the UI) |
| Capture time in Shooting Details | Author can remove it during review; hint shown next to the location step [R] |
| EXIF GPS suggestions (D-08) | Owner-only during editing; deleted on publish |
| Analytics, logs, job payloads, errors, AI inputs | No coordinates and no labels |
| Backups | Access-restricted and encrypted at rest (PQ-054b) |
| Image content (landmarks, house numbers) | Out of technical control; covered by publishing guidance |

**c) Scenario check**

| Scenario | MVP | Future |
|---|---|---|
| One photo → one location | Yes (`role='primary'`) | — |
| Many photos → same location | Yes (index on `explore_location_id`, `mode`) | — |
| One photo → several locations | No | Yes, by adding roles; no redesign |

### 8.3 Future considerations
Roles for viewpoint vs subject; "near me" search using public representations only; author-point clustering on the map.

---

## 9. Challenge submissions (D-09)

### 9.1 Accepted decision
- Challenge submissions are **separate, private entities**, never shown in feeds, profiles or location pages.
- **No publish-submission feature.**

### 9.2 Separate physical files vs shared Media Assets

| | **A. Separate assets, separate files** | **B. Shared Media Asset** (post and submission reference one asset) | **C. Separate asset records, shared physical file** (content dedupe) |
|---|---|---|---|
| Ownership | One owning entity per asset | Two owners | One owner per record, shared blob |
| Access policy | Clear: the owner's policy | Union of policies — a public post makes the "private" submission image reachable; privacy of one depends on the other | Clear per record, but blob access must be checked twice |
| Deletion | Delete files with the owner | Reference counting; deleting a post must keep files for the submission | Blob reference counting |
| Moderation hide (public variants deleted, §7.3 e) | Affects only that entity | Deleting a hidden post's variants would also remove the submission's images | Must coordinate across records |
| Storage cost | Duplicate files if the same photo is used twice (negligible at pilot scale) | No duplication | No duplication |
| Complexity | Lowest | High | Medium–high; cross-user dedupe would also leak whether a file exists elsewhere |

**Recommendation: A — every Media Asset belongs to exactly one owning entity** (post, submission or avatar).
- Using the same photo in two places means uploading it again in the MVP.
- A future convenience (e.g. "use one of my posts for this challenge") would be a **server-side copy** creating a new asset and new variants, not a shared reference.
- AI Coach does not own assets; it reads the owning entity's `ai_analysis` variant, so it does not affect this rule.

### 9.3 Approved technical details
- `media.assets` gets `owner_entity_type` + `owner_entity_id` (set when the post/submission is created) and a uniqueness rule that one asset is referenced by at most one entity.
- Submission flow uses purpose `submission`; its assets are never delivered to anyone but the owner.

### 9.4 Future considerations
Server-side copy for "submit an existing post" or "publish a submission", if ever approved.

---

## 10. Final consolidated decisions (all approved 2026-11-03)

| # | Decision |
|---|---|
| 1 | One PostgreSQL jobs table as a transactional job queue; in-process events with no stored history; unique event-handler jobs; leases with lease-token fencing; classified retries; dead jobs with domain failure hook; operator requeue and user-initiated retry; hand-rolled by default |
| 2 | Canonical brands/models with immutable aliases and provisional models; original names preserved; no automatic verification; merges as edges with depth limit enforced at merge time, cycle rejection and exact undo; search resolves merge chains |
| 3 | Admin-curated locations for the pilot; `source` column; suggestions/imports possible additively later |
| 4 | Standalone AI Coach on own drafts/published posts; Coach owns general rubrics; Learning optional context; challenge context later; private feedback; feature-flagged MVP extension |
| 5 | Per-field profile visibility with owner defaults; unique public handles with redirect history, never reassigned |
| 6 | Pilot essentials / MVP extensions / Future; AI and Learning do not block the pilot; backups, security, monitoring mandatory; vertical slices S0–S5; staging only for invited testers, no indexing, no public registration, test-data and consent rules |
| 7 | Private originals; re-encoded sanitised variants; no GPS anywhere public; revocation by object deletion with accurate wording; time-bucketed signed URLs (B = 1 h, L = 2 h), `private, max-age=3600`, no CDN; emergency rotation disables old credentials; provider checks in PQ-007; orientation and colour preserved |
| 8 | One primary location per photo via a link entity with ID and role; modes exact/approximate/private; selected mode limits all public geography; labels public only in exact mode; deterministic two-level grid; geo queries on public representation only |
| 9 | Private, separate challenge submissions; no publish-submission; one owning entity per Media Asset; owner deletion with no undo; D-23 map shows curated locations only |

---

## 11. Open questions, open decisions and contradictions

### 11.1 Questions Q-1 to Q-12 — status

| ID | Question | Status |
|---|---|---|
| Q-1 | Handle rules | **Approved** |
| Q-2 | Coach owns general rubrics | **Approved** |
| Q-3 | Equipment display rule (canonical if verified, else original text) | Approved with R4-1 (part of §2.2 b) |
| Q-4 | Hide deletes public variants; unhide regenerates; delete removes all | **Approved** (with R4-3 wording) |
| Q-5 | Time-bucketed signed URLs, no CDN | **Approved** (with R4-3 algorithm) |
| Q-6 | Owner deletion without undo | **Approved** |
| Q-7 | Draft expiry 30 days, abandoned uploads 24 h | **Open** — default values, decided in PQ-020b/PQ-022 |
| Q-8 | Hand-rolled jobs implementation | Approved as default (library only with explicit approval in PQ-006) |
| Q-9 | Production environment task | **Approved** as PQ-054a/b |
| Q-10 | `source` column on locations | Approved (cheap, additive) |
| Q-11 | Location privacy model | **Approved** (amended by R4-2 and the label rule) |
| Q-12 | Merge resolution in search | **Approved** (replaced by R4-1) |

### 11.2 Inherited open decisions — all remain open

| ID | Description | Blocks task | Needed by |
|---|---|---|---|
| D-02 | AI provider(s): regional availability, cost, data-use terms | PQ-042a | E1 (tied to R-07) |
| D-03 | Object storage provider; upload size enforcement method (delivery resolved) | PQ-007 checks, PQ-020a, PQ-054a | S1 |
| D-04 | Authentication mechanism and CSRF approach | PQ-010a | S1 |
| D-05 | OpenAPI workflow | PQ-005 | S0 |
| D-06 | Map tiles/provider | PQ-031 | S3 |
| D-07 | Image processing library and formats | PQ-020a | S1 |
| D-08 | EXIF GPS discarded or kept as private suggestion | PQ-020a, PQ-032 | S1 |
| D-11 | Hosting/deployment target | PQ-054a | **S1** (moved earlier by R4-5) |
| D-13 | Analytics implementation | PQ-014 | S5 |
| D-14 | AI allowance values | PQ-043 | E1 |
| D-15 | Seed equipment list contents | PQ-012 | S4 |
| D-16 | Password hashing algorithm | PQ-010a | S1 |
| D-17 | Toolchain versions and libraries | PQ-002 | **S0 — first task** |
| D-18 | Link previews / SEO for public pages | Extension | E3 |
| D-20 | Cell sizes for "area" and "neighbourhood" | PQ-032 | S3 |
| D-21 | Password-reset delivery channel | PQ-010b | S5 |
| D-22 | Learning pages public or sign-in only | PQ-040 | E2 |
| D-23 | MVP map shows curated locations only | — | **Decided** (approved) |
| R-07 | Legal review: data residency and AI data transfer | PQ-053, D-02, D-11 | Pilot gate; start early |

Plus Q-7 above. D-01, D-09, D-10, D-12, D-19 and D-23 are decided; D-24 is superseded by Q-1.

### 11.3 Documentation contradictions C-1 to C-8 — resolved in the synchronization

| # | Contradiction | Resolution applied |
|---|---|---|
| C-1 | No handle in docs | Handles + `handle_history`; `/u/:handle`; redirect responses |
| C-2 | Coach tied to submissions | Subject-based standalone Coach; PQ-042a/b |
| C-3 | Single profile privacy switch | Per-field visibility with owner defaults |
| C-4 | AI/Learning before the pilot; ops only at the end | Three tiers; slices; PQ-054a/b |
| C-5 | Old equipment model | Canonical model with merge edges |
| C-6 | Jobs mechanics missing | ADR-022 mechanics and terminology |
| C-7 | Old `post_locations` shape | Link entity with role; `mode`; privacy model |
| C-8 | Media stripping, revocation gaps | Re-encoding; revocation design; delivery algorithm |

---

## 12. Documents updated in the synchronization

`CLAUDE.md`, `README.md`, `TASKS.md`, `docs/product/mvp-scope.md`, `docs/product/user-flows.md`, `docs/architecture/overview.md`, `docs/architecture/modules.md`, `docs/architecture/database-schema.md`, `docs/architecture/api-contracts.md`, `docs/frontend/architecture.md`, `docs/media/media-and-exif.md`, `docs/ai/coach-specification.md`, `docs/development/coding-standards.md`, `docs/development/setup.md`, ADR-004, ADR-005, ADR-008, ADR-011, ADR-014, ADR-015, ADR-018, ADR-019, ADR-020, ADR-021, ADR-022, ADR-023, ADR-025, `docs/product/vision.md` (Coach and location-mode wording), `docs/analysis/risks-and-open-questions.md`, `docs/analysis/implementation-roadmap.md`, this document, and the new changelog `docs/analysis/documentation-sync-2026-11-03-r4.md`.

---

## 13. MVP scope and roadmap

- **Pilot essentials:** §6.2.
- **MVP extensions:** E1 AI Coach (PQ-043, PQ-042a, feature-flagged); E2 Learning (PQ-040, PQ-041, PQ-042b); E3 others (admin screens, extra filters, link previews, GPS suggestion, notifications).
- **Future:** §6.2.
- **Delivery order:** slices S0–S5 (§6.3), then the pilot gate (PQ-051, PQ-052). Extensions follow, ordered by pilot feedback.

Critical path: PQ-002 → PQ-003 → PQ-005 → PQ-006/PQ-007 → PQ-020a → PQ-021a → PQ-022 → PQ-032 → PQ-021b/PQ-034 → PQ-050/PQ-053 → PQ-052, with PQ-054a in S1 and PQ-054b done before PQ-052.

First implementation task: **PQ-002 — project skeleton**, starting with the D-17 proposal for approval.

---

## 14. Approval record

All 17 items of the Revision 4 proposal were approved on 2026-11-03, with these owner clarifications incorporated:
1. R4-1 — maximum chain depth enforced at merge creation; tests for long chains, cycles, brand merges and undo (§2.2 e).
2. R4-2 — free-text labels hidden in approximate and private modes (§8.2 b).
3. R4-3 — provider compatibility checks in PQ-007; emergency rotation explicitly disables old signing credentials (§7.3 e–f).
4. R4-5 — staging only for invited testers, no search-engine indexing, public registration disabled, test-data and consent rules before S5 (§6.3).

Remaining open items are listed in §11.2 and are recorded as open in `risks-and-open-questions.md`.
