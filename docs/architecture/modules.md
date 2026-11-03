# Module Boundaries

The system is a modular monolith. Each module owns its domain rules and data and exposes application interfaces to other modules. Modules must not reach into another module's internal packages or tables.

| Module | Status |
|---|---|
| Identity, Profiles, Equipment, Media, Community, Explore, Moderation, Admin (thin) | MVP — pilot essential |
| Billing (minimal), Coach, Content, Learning | MVP — extension |
| Notifications, Academy, Social Integrations, Gear Explorer | Future |

## Identity — pilot essential
Owns accounts, credentials, sessions, password reset tokens, roles (`user`, `admin`), invite codes (staging), and account status/deletion. Provides the viewer context used for authorization.

## Profiles — pilot essential
Owns the **handle** (unique, `a–z0–9_`, 3–30 characters, case-insensitive, reserved words, 30-day change cooldown) and **handle history** (old handles redirect permanently and are never reassigned; deleted accounts' handles stay reserved without personal data), display name, avatar reference, bio, experience level, onboarding state, **per-field visibility** (bio default private, equipment default public, Instagram default private; experience level private in MVP) and the Instagram URL/username. No Instagram OAuth or sync. Public profile pages combine Profiles data with a Community query for the author's published posts.

## Equipment — pilot essential
Owns canonical brands and models (cameras, lenses), **immutable aliases** (key = normalised brand text + model text), **provisional** models created from unknown names, verification (admin only, never automatic), **merge edges** (`merged_into_id`; aliases and history never move or change), merge logs with undo, and user gear (resolved model + original entered text). Merge creation enforces a maximum chain depth and rejects cycles. Exposes `Resolve(text)`, `ResolveEffective(modelIDs)` and `ModelsResolvingTo(modelID)` (ADR-011).

## Media — pilot essential
Owns asset lifecycle, upload intents, storage keys, variants, validation, EXIF extraction into the shared Shooting Details value type (raw allowlisted strings preserved), processing status and file deletion. **Every asset belongs to exactly one owning entity** (post, submission or avatar). Originals are private; variants are re-encoded without metadata. Media does not decide product visibility — the owning module does, then requests delivery URLs (ADR-004, ADR-014, ADR-023).

## Community — pilot essential
Owns photo posts (draft → published → hidden/deleted), captions, attribution, the post Shooting Details snapshot, **post-location links** (own ID, `role = primary`, `mode` exact/approximate/private, derived grid cell, label), the public feed, merge-aware photo filtering, and photo bookmarks. Enforces location privacy: the mode limits all public geographic output. Exposes `ListPublicPostsForLocation` (exact-mode only) and author-post queries. Authorises "Ask the Coach" for the owner's posts (extension) (ADR-020).

MVP excludes comments, reactions, follows, groups and messaging.

## Explore — pilot essential
Owns curated locations, categories, descriptions, practical notes, exact (private) and public coordinates/precision, status, `source` (`editorial` in MVP), location search and saved locations. Does **not** own post-location links; reads linked public photos via Community. The MVP map shows curated locations only.

Future, additive: user location suggestions (`location_suggestions` + approval use case), external imports (`location_external_refs` + import job), localised names.

## Moderation — pilot essential
Owns reports (target type + ID, reason, status, resolution). Resolution actions call owning modules (`community.HidePost`, `explore.UpdateLocation`, `profiles.ForceHandleChange`); Moderation never edits other modules' data (ADR-025).

## Admin — pilot essential (thin)
Admin HTTP route group and orchestration: locations, moderation, equipment verify/merge/undo, dead-job requeue, entitlement overrides, handle changes. Owns no domain tables; requires the admin role; audit-logs important actions.

## Billing — extension (minimal)
Feature-key entitlements (default limits from configuration, per-user overrides by admins) and atomic usage counters. Introduced with the AI Coach. Plans, subscriptions and payments are future scope (ADR-007).

## Coach — extension
Owns AI analyses of photos **the requester owns**: subject (`post` now, `submission` later), context (`general` focus + question using Coach-owned general rubrics; later `challenge` with rubrics provided by Content/Learning), provider adapters, prompt versions, feedback schema, private feedback, ratings, analysis lifecycle. Independent of Learning; called by the owning module after its authorisation; asks Billing for allowance (ADR-008).

## Content — extension (seeded)
Paths, lessons, challenge definitions, instructions, rubrics, status, loaded from version-controlled seed data; archived, never hard-deleted. Provides challenge rubrics to Coach through an optional interface.

## Learning — extension
Path enrolment, lesson progress, **private challenge submissions** (separate from posts; their own Media Assets), submission Shooting Details snapshots, completion and history. No publish-submission feature.

## Shared kernel: Shooting Details
`shared/shootingdetails` defines the value type, units, normalisation, validation and provenance, including `*_raw_text` + `*_model_id` for equipment fields. No persistence; imports no module (ADR-021).

## Future modules
- **Notifications:** delivery orchestration and preferences.
- **Academy:** instructors, paid courses, cohorts.
- **Social Integrations:** OAuth connections and imports (ADR-016); Instagram links remain Profiles data (ADR-017).
- **Gear Explorer:** discovery across equipment and settings.
- **Rich Community:** comments, reactions, follows, groups, messaging.
- **Advanced Explore:** suggestions, imports, routes, forecasts; multiple location roles per photo.

## Cross-module relationships (summary)

| Relationship | Owner | Others access via |
|---|---|---|
| Post ↔ location link + mode | Community | Explore calls `community.ListPublicPostsForLocation` (exact only) |
| Location record + public precision | Explore | Community calls `explore.GetPublishedLocation` |
| File, variants, extracted metadata | Media (one owning entity per asset) | Owners request delivery URLs after their policy check |
| Shooting Details snapshot (post / submission) | Community / Learning | — |
| Shooting Details rules | Shared kernel | Media, Community, Learning, Equipment |
| Equipment resolution and merges | Equipment | `Resolve`, `ResolveEffective`, `ModelsResolvingTo` |
| AI analysis of an owned photo | Coach | Called by Community (posts) or Learning (submissions) |
| Usage allowance | Billing | Coach reserve/consume/release |
| Reports | Moderation | Resolution calls owning modules |
