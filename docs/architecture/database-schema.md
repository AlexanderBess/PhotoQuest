# Database Design — Logical Model (MVP)

Logical model for the narrowed discovery-first MVP (ADR-018), updated with the approved decisions of 2026-11-03 (decision record Revision 4). Not a migration script: exact types, constraints, indexes and `ON DELETE` behaviour are finalised in each task's migration. Tables are created in the slice that needs them.

Conventions: UUID primary keys for externally referenced entities; UTC `timestamptz`; `created_at`/`updated_at` on mutable tables (omitted below unless relevant); status columns use check constraints or enums. Values marked [A] are defaults.

## Identity

### `identity.users`
- `id`, `email` (normalised, unique), `password_hash`
- `role` (`user`, `admin`)
- `status` (`active`, `disabled`, `deleted`)
- `terms_accepted_version`, `terms_accepted_at` (nullable)

### `identity.sessions`
- `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`, `last_seen_at` (shape per D-04; hashed tokens either way)

### `identity.password_reset_tokens`
- `id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`

### `identity.invites` (staging and invite-only access)
- `id`, `code_hash`, `created_by_user_id`, `expires_at`, `used_by_user_id`, `used_at`

Account deletion semantics are defined in PQ-010b.

## Profiles

### `profiles.user_profiles`
- `user_id` PK/FK
- `handle` (lowercase `a–z0–9_`, 3–30, starts with a letter; unique)
- `handle_changed_at` (for the 30-day cooldown [A])
- `display_name`, `bio`, `avatar_asset_id` (nullable)
- `experience_level` (values defined in PQ-011; private in MVP)
- `bio_visibility` (`public`, `private`; default `private`)
- `gear_visibility` (`public`, `private`; default `public`)
- `onboarding_completed_at` (nullable)

### `profiles.handle_history`
- `handle` PK — retired handle; never reassigned to another user
- `user_id` nullable — the owner; set to null when the account is deleted (reserved without personal data)
- `retired_at`
- Uniqueness of a new handle is checked against `user_profiles.handle`, `handle_history.handle` and `profiles.reserved_handles`.

### `profiles.reserved_handles` (seeded)
- `handle` PK, `reason` (`system`, `brand`, `profanity`)

### `profiles.external_profiles`
- `id`, `user_id`, `provider` (`instagram`), `profile_url`, `username`
- `visibility` (`public`, `private`; default `private`)
- unique (`user_id`, `provider`)

## Equipment (ADR-011)

### `equipment.brands`
- `id`, `canonical_name`, `slug`, `status` (`verified`, `provisional`)
- `merged_into_id` nullable (direct merge target)
- `created_source` (`seed`, `exif`, `user`, `admin`), `verified_by`, `verified_at`

### `equipment.brand_aliases`
- `alias_key` PK (normalised brand text), `brand_id` (immutable), `source`, `first_seen_text`

### `equipment.models`
- `id`, `kind` (`camera`, `lens`), `brand_id`, `canonical_name`, `slug`
- `status` (`verified`, `provisional`) — no `merged` value; merged means `merged_into_id IS NOT NULL`
- `merged_into_id` nullable — direct merge target; never rewritten by later merges
- `attributes` JSONB (mount, `fixed_lens`, focal range, max aperture — optional)
- `created_source`, `verified_by`, `verified_at`
- check: `merged_into_id <> id`

### `equipment.model_aliases`
- (`kind`, `alias_key`) PK — `alias_key` = normalised brand text + `|` + normalised model text
- `model_id` (immutable), `source`, `first_seen_text`

### `equipment.model_merges` / `equipment.brand_merges`
- `id`, `source_id`, `target_id`, `merged_by`, `merged_at`, `note`, `undone_by`, `undone_at`

Merge rules (enforced in the merge use case inside one transaction with row locks): maximum chain depth **5 [A]** checked at merge creation; cycles rejected; undo only while the edge is in effect. Resolution follows `merged_into_id` with the same depth bound.

### `equipment.user_equipment`
- `id`, `user_id`, `model_id`, `entered_brand_text`, `entered_model_text`, `nickname`, `is_primary`

## Media

### `media.assets`
- `id`, `owner_user_id`
- `purpose` (`post`, `submission`, `avatar`)
- `owner_entity_type`, `owner_entity_id` — exactly one owning entity; unique (`owner_entity_type`, `owner_entity_id`) where set
- `status` (`pending_upload`, `uploaded`, `processing`, `ready`, `failed`, `deleted`)
- `storage_key_original` (private), `mime_type` (verified by signature), `size_bytes`, `width`, `height`, `checksum_sha256`
- `processing_generation` int (incremented by "Retry processing")
- `current_key_version` (random; rotated when public variants are regenerated)
- `failure_code` nullable, `deleted_at` nullable

### `media.variants`
- `id`, `asset_id`, `kind` (`display_large`, `display_medium`, `thumbnail`, `ai_analysis`), `key_version`
- `storage_key`, `mime_type`, `width`, `height`, `size_bytes`
- unique (`asset_id`, `kind`, `key_version`)
- All variants are re-encoded without metadata; public kinds are deleted on hide.

### `media.extracted_metadata`
- `asset_id` PK/FK
- `shooting_details` JSONB — shared value type; never contains GPS
- `raw_allowlist` JSONB — allowlisted raw EXIF strings (Make, Model, LensMake, LensModel, Software, exposure fields); never GPS, serial numbers, owner/artist fields, MakerNotes, XMP/IPTC location
- `gps_suggestion` — only if D-08 decides to keep it; owner-only; deleted on publish or draft expiry
- `extraction_status` (`ok`, `partial`, `none`, `failed`), `extracted_at`

## Shooting Details columns (shared shape, ADR-021)

Used by `community.post_shooting_details` and `learning.submission_shooting_details`:
- `camera_raw_text`, `camera_model_id` (nullable)
- `lens_raw_text`, `lens_model_id` (nullable)
- `focal_length_mm`, `aperture_f`, `shutter_speed_s`, `iso`, `exposure_compensation_ev`, `flash_fired` (all nullable)
- `captured_at_local` (timestamp without zone), `captured_at_utc_offset` (nullable)
- `software` (nullable)
- `source` (`exif`, `manual`, `mixed`), `field_sources` JSONB

`null` means unknown. Model IDs may be filled later from raw text (S4 backfill). Merges never rewrite these columns. Location is not part of Shooting Details.

## Community

### `community.posts`
- `id`, `author_user_id`, `media_asset_id` (unique)
- `title`, `caption` (nullable)
- `status` (`draft`, `published`, `hidden`, `deleted`)
- `published_at`, `hidden_at`, `hidden_reason` (nullable)
- index (`status`, `published_at` desc, `id`)

### `community.post_shooting_details`
- `post_id` PK/FK + Shooting Details columns
- indexes on `camera_model_id`, `lens_model_id`

### `community.post_locations` (ADR-015, ADR-020)
- `id` PK
- `post_id` FK, `ON DELETE CASCADE`
- `role` (`primary` only in MVP)
- `explore_location_id` nullable, `ON DELETE RESTRICT`
- `point_lat`, `point_lng` nullable — exact author point; public only in exact mode
- `approx_level` (`area`, `neighbourhood`) nullable
- `approx_cell_id`, `approx_lat`, `approx_lng`, `approx_cell_size_m` nullable — derived deterministic grid cell
- `label` nullable — public only in exact mode
- `mode` (`exact`, `approximate`, `private`)
- `point_source` (`manual`, `exif_suggestion_confirmed`) nullable
- unique (`post_id`, `role`)
- check: `explore_location_id IS NOT NULL OR point_lat IS NOT NULL`
- check: `mode <> 'approximate' OR approx_cell_id IS NOT NULL`
- index (`explore_location_id`, `mode`) for place pages (exact only)
- index on public representation for viewport queries (exact point / cell centre)

### `community.photo_bookmarks`
- `user_id`, `post_id`, `created_at`; PK (`user_id`, `post_id`)

## Explore

### `explore.location_categories` (seeded)
- `id`, `slug`, `name`, `position`

### `explore.locations`
- `id`, `slug`, `name`, `category_id`, `description`, `practical_notes`
- `exact_lat`, `exact_lng` (private)
- `public_lat`, `public_lng`, `public_precision` (`exact`, `approximate`)
- `status` (`draft`, `published`, `archived`)
- `source` (`editorial` in MVP)
- `created_by_user_id`
- name search index (technique chosen in PQ-034; must work for Russian)

### `explore.saved_locations`
- `user_id`, `location_id`, `created_at`; PK (`user_id`, `location_id`)

## Moderation

### `moderation.reports`
- `id`, `reporter_user_id`
- `target_type` (`post`, `post_shooting_details`, `post_location`, `location`, `profile`, `ai_feedback`), `target_id`
- `reason`, `comment`
- `status` (`open`, `resolved`, `dismissed`), `resolution`, `resolved_by_user_id`, `resolved_at`
- unique open report per (`reporter_user_id`, `target_type`, `target_id`)

## Billing (extension, minimal)

### `billing.entitlement_overrides`
- `user_id`, `feature_key`, `limit_value`, `set_by_user_id`, `created_at`; PK (`user_id`, `feature_key`)

### `billing.usage_counters`
- `user_id`, `feature_key`, `period_start`, `period_end`, `used`, `reserved`; unique (`user_id`, `feature_key`, `period_start`)

Feature key: `ai.coach.analyses_per_month`. Default limits from configuration.

## Coach (extension)

### `coach.analyses`
- `id`, `user_id`
- `subject_type` (`post`; later `submission`), `subject_id`, `media_asset_id`
- `context` JSONB (`{type: general, focus, question}`; later `{type: challenge, challenge_id}`)
- `input_fingerprint`
- `provider`, `model`, `prompt_version`, `rubric_version`
- `status` (`queued`, `running`, `succeeded`, `failed`)
- `input_tokens`, `output_tokens`, `latency_ms`, `estimated_cost`, `attempts`, `error_code`

### `coach.feedback`
- `id`, `analysis_id` unique, `summary`, `strengths`, `improvements`, `next_exercise`, `limitations` (JSONB), `helpfulness_rating`, `created_at`
- Private to the subject's owner; deleted with the subject.

## Content and Learning (extension)

### `content.learning_paths`, `content.lessons`, `content.challenges`
As before: seeded, with `status` (`draft`, `published`, `archived`); challenges carry `instructions`, `submission_requirements`, `review_rubric`.

### `learning.path_enrollments`, `learning.lesson_progress`
As before.

### `learning.submissions`
- `id`, `user_id`, `challenge_id`, `media_asset_id` (its own asset), `caption`, `status`, `submitted_at`
- Private; never listed publicly.

### `learning.submission_shooting_details`
- `submission_id` PK/FK + Shooting Details columns

## Platform

### `platform.jobs` (ADR-022)
- `id`, `kind`, `payload` JSONB (IDs only), `dedupe_key`
- `status` (`pending`, `running`, `succeeded`, `dead`)
- `run_after`, `attempts`, `max_attempts`, `lease_token`, `locked_until`
- `last_error` (sanitised), `last_error_class` (`transient`, `permanent`), `manual_retries`
- `created_at`, `updated_at`, `finished_at`
- unique (`kind`, `dedupe_key`); index (`status`, `run_after`)
- A transactional job queue, not an event store.

### `platform.audit_log`
- `id`, `actor_user_id`, `action`, `target_type`, `target_id`, `details` JSONB (no secrets, coordinates or labels), `created_at`

### `platform.analytics_events` (if D-13 chooses the in-house option)
- `id`, `occurred_at`, `name`, `user_id` nullable, `anonymous_id` nullable (opaque, rotating), `properties` JSONB (allowlisted keys)
- No IP addresses, viewer locations, coordinates, labels, image contents or EXIF values.

### `platform.feature_flags`
- `key` PK, `enabled`, `allowed_user_ids` (nullable), `updated_at`

## Future (not created in MVP)

- Community: comments, reactions, follows, groups; additional `post_locations.role` values.
- Explore: `location_suggestions`, `location_external_refs`, localised names, collections, routes.
- Billing: plans, subscriptions.
- Academy, Social Integrations, an `outbox_events` history table if ever needed.

## General data rules

- Define `ON DELETE` behaviour intentionally per relation.
- Use transactions for multi-entity state transitions; insert jobs in the same transaction.
- Add indexes from real query patterns.
- JSONB only for flexible structured content.
- Cross-schema foreign keys are allowed (ADR-003); module code still accesses other modules only through their interfaces.
