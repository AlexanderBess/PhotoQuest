# API Contract Principles

Proposed MVP surface, updated with the approved decisions of 2026-11-03. The OpenAPI document is the contract source of truth; each endpoint's schema is written in OpenAPI **before** it is implemented (CLAUDE.md §8). Endpoints are added in the slice that needs them.

Access markers: **[public]** — anonymous allowed in production (signed-in viewers may see extra fields such as `saved`); **[auth]** — signed-in user; **[admin]** — admin role. In staging, the whole API sits behind the access gate.

## General conventions

- Base path: `/api/v1`; JSON; UUID identifiers; UTC ISO 8601 timestamps.
- Consistent error envelope with stable error `code`s; user-facing text is localised in the frontend.
- Cursor pagination for feeds and public lists (`?cursor=&limit=` → `next_cursor`); offset allowed for admin lists.
- Authorization in backend use cases (ADR-019); ownership from the viewer context only.
- Responses use **allowlisted serializers**. Public responses never include storage keys, original-file URLs, raw EXIF, GPS, or location data beyond what the post's mode allows.

## Error envelope

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The request is invalid.", "details": [] } }
```

No stack traces, provider secrets, storage keys, coordinates or internal messages.

## Health
- `GET /healthz`, `GET /readyz` [public] — served at the root, outside the `/api/v1` base path (infrastructure probes)

## Identity
- `POST /auth/register` [public] — disabled in staging; requires an invite code where invite-only access is enabled
- `POST /auth/login` [public], `POST /auth/logout` [auth]
- `POST /auth/password-reset/request` [public] (uniform response), `POST /auth/password-reset/confirm` [public]
- `POST /auth/refresh` — only if D-04 chooses refresh tokens
- `GET /me` [auth], `POST /me/terms-acceptance` [auth], `DELETE /me` [auth]

CSRF protection is required for state-changing requests if cookies are used (D-04).

## Profiles and handles
- `GET /handles/availability?handle=` [public, rate-limited] — validity and availability (checks current, retired and reserved handles)
- `GET /profiles/{handle}` [public]:
  - current handle → profile with fields allowed by per-field visibility (handle, display name, avatar always; bio/equipment/Instagram only if public);
  - retired handle of an active account → `200 { "redirect_to": "<current handle>" }`;
  - unknown, reserved, deleted, disabled or hidden → `404`.
- `GET /profiles/{handle}/posts` [public] — published posts
- `GET /me/profile`, `PATCH /me/profile` [auth] — includes `bio_visibility`, `gear_visibility`
- `PUT /me/handle` [auth] — 30-day cooldown; returns `409 HANDLE_TAKEN` or `429 HANDLE_CHANGE_COOLDOWN`
- `GET/PATCH /me/onboarding` [auth]
- `PUT /me/external-profiles/instagram` (with `visibility`, default `private`), `DELETE …` [auth]

## Equipment
- `GET /equipment/models?kind=&q=` [public] — effective (merge-resolved) models; provisional models labelled
- `GET /me/equipment`, `POST /me/equipment` (text or model ID; original text stored), `PATCH/DELETE /me/equipment/{id}` [auth]

## Media
- `POST /media/upload-intents` [auth] — purpose, size, type → upload target (method D-03)
- `POST /media/{assetId}/complete` [auth, owner] — idempotent
- `GET /media/{assetId}` [auth, owner] — status and extracted Shooting Details
- `POST /media/{assetId}/retry-processing` [auth, owner] — new processing generation

Delivery URLs are embedded by the owning module (ADR-023): public variants of published posts use time-bucketed URLs; owner/admin views use 5-minute URLs.

## Posts, feed and bookmarks
- `POST /posts` [auth] — draft from an owned asset (idempotency key)
- `GET /posts/{postId}` [public if published and not hidden; owner otherwise]
- `PATCH /posts/{postId}` [auth, owner] — title, caption
- `PUT /posts/{postId}/shooting-details` [auth, owner]
- `PUT /posts/{postId}/location` [auth, owner] — `{ location_id?, point?, label?, mode, approx_level? }`; `mode` required
- `DELETE /posts/{postId}/location` [auth, owner]
- `POST /posts/{postId}/publish` [auth, owner] — requires a ready asset and terms acceptance
- `DELETE /posts/{postId}` [auth, owner]
- `GET /me/posts?status=` [auth]
- `GET /feed?cursor=&location_id=&camera_model_id=&lens_model_id=` [public] — `location_id` matches exact-mode links only; model filters are merge-aware
- `PUT/DELETE /posts/{postId}/bookmark` [auth], `GET /me/bookmarks/posts` [auth]

**Public `location` representation (ADR-015)**
```jsonc
// exact — each field optional, present only if provided by the author
"location": { "mode": "exact", "place": { "id": "…", "name": "…" }, "point": { "lat": 55.0302, "lng": 82.9204 }, "label": "…" }
// approximate — area only: no place, no point, no label
"location": { "mode": "approximate", "area": { "center": { "lat": 55.03, "lng": 82.92 }, "size_m": 5000 } }
// private — field absent
```
Owner endpoints return the stored data (place link, exact point, label) in every mode.

## Explore
- `GET /location-categories` [public]
- `GET /locations?q=&category=&bbox=&cursor=` [public] — published places, public coordinates only
- `GET /locations/{locationId}` [public]
- `GET /locations/{locationId}/posts?cursor=` [public] — exact-mode, published, non-hidden posts only
- `PUT/DELETE /locations/{locationId}/save` [auth], `GET /me/saved-locations` [auth]

Any geographic filter, sort or count operates on public representations only.

## Reports
- `POST /reports` [auth] — `{ target_type, target_id, reason, comment? }`

## Analytics
- `POST /events` [public] — allowlisted client events only (D-13)

## AI Coach (extension, feature-flagged)
- `POST /posts/{postId}/analyses` [auth, owner] — `{ focus, question? }` → analysis status; allowance checked
- `GET /posts/{postId}/analyses` [auth, owner]
- `POST /feedback/{feedbackId}/rating` [auth, owner]
- `GET /me/usage` [auth]

## Learning (extension)
- `GET /learning-paths`, `GET /learning-paths/{pathId}`, `GET /lessons/{lessonId}`, `GET /challenges/{challengeId}` [access D-22]
- `POST /learning-paths/{pathId}/enroll`, `GET /learning-paths/{pathId}/progress`, `POST /lessons/{lessonId}/complete` [auth]
- `POST /submissions` [auth] (own asset, idempotency key), `PUT /submissions/{id}/shooting-details`, `GET /submissions`, `GET /submissions/{id}` [auth, owner]
- `POST /submissions/{id}/analyses`, `GET /submissions/{id}/analyses` [auth, owner] — challenge context

## Admin — `/api/v1/admin/*` [admin]
- Locations: list/create/get/update, publish, archive
- Posts: hide, unhide
- Reports: list, resolve, dismiss
- Equipment: `POST /admin/equipment/models/{id}/verify`, `POST /admin/equipment/merges` (`{source_id, target_id, note}`; depth and cycle checks), `POST /admin/equipment/merges/{id}/undo`, `DELETE /admin/equipment/aliases/{kind}/{alias_key}`; same for brands
- Jobs: `GET /admin/jobs?status=dead`, `POST /admin/jobs/{id}/requeue`
- Profiles: `POST /admin/profiles/{userId}/force-handle-change`
- Invites: `POST /admin/invites`
- Entitlements (extension): `PUT /admin/users/{userId}/entitlements/{featureKey}`
- Every state-changing admin call writes an audit-log entry.

## Idempotency and retries

- Registration, upload completion, post creation, publishing, submissions, bookmark/save toggles, merges/undos and analysis requests are safe to retry; idempotency keys where retries could duplicate.
- Jobs are retry-safe (ADR-022). A failed analysis does not consume allowance.

## OpenAPI

Maintain the OpenAPI document as the contract; generate server interfaces and TypeScript types where practical (D-05). Generated code never replaces domain validation.
