# System Architecture

## Architectural style

**Modular monolith** (ADR-001). One backend codebase and binary, one PostgreSQL database with logical schemas, run as two processes: the API and the background worker.

Do not split into microservices unless operational scale or independent team ownership later justifies it.

## High-level components

```text
Browser (public visitor or signed-in user)
  |
  v
Vue 3 Web App (Russian UI, i18n-ready)
  |
  v
Go REST API  ------------------------------  PostgreSQL
  |   (viewer context: anonymous/user/admin)    |  module schemas
  |                                              |  platform.jobs (transactional job queue)
  +---- Storage adapter --> S3-compatible        |
  |      object storage (private bucket)         |
  |      signed URLs returned to browsers        v
  |                                     Background Worker (same binary)
  |                                       |            |
  |                                       v            v
  |                                 Media processing  AI provider adapter (extension)
  +---- Map tiles are loaded by the browser through a frontend map adapter
```

Environments: local (Docker Compose), **staging** (invited testers only, access gate, no indexing, separate data and credentials) and production.

## Backend modules (MVP)

| Module | Owns | Tier |
|---|---|---|
| `identity` | Accounts, credentials, sessions, password reset, roles, invites (staging) | Pilot essential |
| `profiles` | Handles and handle history, profile fields, per-field visibility, onboarding state, Instagram link | Pilot essential |
| `equipment` | Canonical brands/models, immutable aliases, provisional models, merge edges and logs, user gear | Pilot essential |
| `media` | Upload intents, assets (one owner each), variants, storage keys, extracted metadata, processing | Pilot essential |
| `community` | Posts, post Shooting Details snapshots, post-location links and modes, feed, photo bookmarks | Pilot essential |
| `explore` | Curated locations, categories, public precision, saved locations, location search | Pilot essential |
| `moderation` | Reports and their resolution workflow | Pilot essential |
| `admin` | Admin HTTP route group and orchestration — calls other modules' interfaces; owns no domain tables | Pilot essential |
| `billing` | Feature-key entitlements and usage counters (no plans/payments) | Extension (with Coach) |
| `coach` | AI analyses of owned photos, provider adapters, feedback, ratings | Extension |
| `content` | Learning paths, lessons, challenges (seeded) | Extension |
| `learning` | Enrolments, progress, private submissions and their Shooting Details snapshots | Extension |

Shared kernel (no persistence, no module dependencies):
- `shared/shootingdetails` — Shooting Details value type, normalisation, validation, provenance, original equipment text + resolved model IDs (ADR-021).

Platform (technical capabilities, no product rules):
- `database`, `jobs` (transactional job queue and in-process event dispatcher, ADR-022), `storage` (adapter, ADR-023), `auth` (viewer context, session middleware), `config`, `logger`, `observability`, `audit` (append-only audit log), `analytics` (event recorder), `featureflags`, `mailer` (once D-21 is decided).

Future modules (not created in MVP): `notifications`, `academy`, `socialintegrations`, `gearexplorer`, rich Community features, location suggestions/imports. Create a package only when an approved task needs it.

## Ownership of cross-cutting relationships

- **Photo ↔ location** (ADR-020): Community owns `community.post_locations` (own ID, `role = primary`, `mode`). Explore owns curated location records. Explore lists photos for a place by calling `community.ListPublicPostsForLocation`, which returns exact-mode, published, non-hidden posts only. Community validates a place through `explore.GetPublishedLocation`.
- **Shooting Details** (ADR-021, ADR-013): Media produces extracted values as the shared value type; Community and Learning store their own snapshots; Equipment resolves text to models without discarding the text.
- **Equipment merges** (ADR-011): merges are `merged_into_id` edges; Community filters with `ModelsResolvingTo(model)` from Equipment against its own snapshot table.
- **Media**: every asset belongs to exactly one owning entity (ADR-004). The owning module applies its policy, then asks Media for delivery URLs. Media never decides product visibility and never returns the original.
- **Coach** (extension, ADR-008): Community authorises "analyse my post" and passes the asset to Coach; Coach reads the `ai_analysis` variant; Learning will call Coach the same way for submissions. Coach never depends on Learning.
- **Usage limits**: Coach asks Billing to reserve/consume/release allowance.
- **Moderation**: resolution actions call owning modules (e.g. `community.HidePost`).

## Dependency rules

- Modules expose public interfaces through their package boundary; no imports of another module's internals; no access to another module's tables.
- Cross-module reads use query interfaces; cross-module writes use use-case interfaces or jobs.
- No circular dependencies; where two modules call each other (Explore ↔ Community), use consumer-declared interfaces wired in `app/`.
- Platform and shared kernel packages do not import modules.

## Authorization (ADR-019)

- Middleware resolves a **viewer context**: anonymous, user (ID), or admin. Handlers pass it to use cases.
- Each use case enforces its own policy; UI hiding is never the security boundary.
- Public queries filter in the query: only `published`, non-hidden posts; only `published` places; location data reduced to what the post's mode allows.
- Profile fields are returned according to per-field visibility; ownership is derived from the viewer context.
- Admin endpoints live under `/api/v1/admin`, require the admin role in middleware, and admin use cases re-check it.
- Rate limits for auth, handle availability checks, uploads, reports, AI analysis and expensive public queries (per instance in MVP).
- Staging adds an access gate in front of the whole site and disables public registration.

## Background processing (ADR-005, ADR-022)

- `platform.jobs` is a **transactional job queue**: a module inserts job rows in the same transaction as its domain change. `events.Publish(tx, event)` is an in-process dispatcher that inserts one job per registered handler (`dedupe_key = event_id`). **Events are not stored**; there is no event history or replay.
- The worker claims jobs with `FOR UPDATE SKIP LOCKED` and a lease token; completions are fenced by the token so stale workers cannot overwrite results; handlers are idempotent (at-least-once delivery).
- Transient errors retry with backoff; permanent errors and exhausted retries mark the job `dead` and run the handler's final-failure hook in the same transaction.
- Operators can requeue dead jobs (CLI/admin endpoint); users retry processing by creating a new job generation.
- Job kinds: `media.process_asset`, `media.delete_public_variants`, `media.regenerate_public_variants`, `media.delete_asset_files`, periodic cleanup/reconciliation jobs, and (extension) `coach.analyze`.

## Media processing and delivery (ADR-004, ADR-012, ADR-014, ADR-015, ADR-023)

1. Upload intent → upload to `incoming/` via the storage adapter → completion verified (existence, size, signature) → moved to `originals/` → `media.process_asset` enqueued in the same transaction.
2. Processing: pixel limit before decode → EXIF allowlist extraction (raw strings preserved; no serials, no location metadata; GPS only per D-08) → orientation applied → sRGB conversion → **re-encoded** variants (display sizes, thumbnail, `ai_analysis`) under a random `key_version`.
3. Asset `ready`, or `failed` with a recoverable state.
4. Delivery: public variants of published posts via **time-bucketed signed URLs** (B = 1 h, lifetime 2 h, `private, max-age=3600`); owner/admin views via 5-minute URLs. No CDN in the pilot.
5. Hide → public variants deleted; unhide → regenerated under a new `key_version`; delete → original and all variants deleted. Copies already delivered to viewers cannot be recalled.
6. Emergency: rotate and **disable** old signing credentials (runbook).

## Location privacy

- Each post location has one mode (exact / approximate / private); the mode limits all public geographic information (place link, point, label, listings, filters, counts).
- Approximation is deterministic snapping to a metric-aware grid ("area" default, "neighbourhood" opt-in); exact points never leave the server outside exact mode.
- All geographic queries use the public representation only.

## Data architecture

One PostgreSQL database with logical schemas: `identity`, `profiles`, `equipment`, `media`, `community`, `explore`, `moderation`, `billing`, `coach`, `content`, `learning`, `platform`. See `database-schema.md`.

## Suggested backend layout

```text
backend/
  cmd/
    api/
    worker/
  internal/
    modules/
      identity/ profiles/ equipment/ media/ community/ explore/
      moderation/ admin/ billing/ coach/ content/ learning/
    shared/
      shootingdetails/
    platform/
      database/ jobs/ storage/ auth/ config/ logger/
      observability/ audit/ analytics/ featureflags/
    app/
      bootstrap.go
      dependencies.go
  migrations/
  openapi/
  seeds/          # location categories, equipment seed list, reserved handles, (extension) learning content
```

Extension modules are created only when their slice/extension starts.

## Security and privacy

- Authorization in backend use cases, not only in UI.
- Originals private; storage keys never exposed; variants re-encoded.
- Raw EXIF never exposed; GPS never in any variant or public output.
- Non-public location data (exact points outside exact mode, labels outside exact mode, place links in approximate mode) never returned by public endpoints.
- Secrets outside source control; logs exclude tokens, signed URLs, storage keys, coordinates and labels.

## Future expansion

Rich Community, advanced Explore (suggestions, imports, routes), Academy, Gear Explorer and Social Integrations attach as new modules using the shared Identity, Profiles, Media, Equipment, Billing, Moderation and jobs capabilities. This is not a commitment to implement them in the MVP.
