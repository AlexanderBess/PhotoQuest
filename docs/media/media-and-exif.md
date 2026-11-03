# Media, Image Processing, and EXIF

Related ADRs: ADR-004 (shared Media, one owner per asset), ADR-012 (best-effort EXIF), ADR-013/021 (Shooting Details), ADR-014 (originals and re-encoded variants), ADR-015 (location privacy), ADR-022 (jobs), ADR-023 (storage, delivery, revocation). Decision record: `docs/analysis/decision-review-2026-11-03.md` §7.

## Binding rules

- Originals are private and never delivered to clients.
- Public variants are generated independently (decode → re-encode) and contain no metadata.
- GPS is never exposed through image files, API responses, analytics, logs, job payloads, errors or AI inputs.
- Orientation and colour appearance are preserved.
- Every asset belongs to exactly one owning entity (post, submission or avatar); assets are never shared.

## Lifecycle

| Stage | What happens |
|---|---|
| 1. Upload intent | Client declares purpose, size, type; server checks auth, rate limits, allowlist; creates asset `pending_upload` (and a draft post for purpose `post`); returns an upload target via the storage adapter (method D-03) |
| 2. Temporary storage | Object written to `incoming/{assetId}` in the private bucket; abandoned uploads and `pending_upload` assets removed after ~24 h [A] by a cleanup job (and a bucket lifecycle rule if available) |
| 3. Completion | Idempotent; server verifies existence, actual size, file signature; failure → asset `failed`, object deleted; success → copied to `originals/{assetId}`, `incoming/` deleted, asset `uploaded`, `media.process_asset` enqueued in the same transaction |
| 4. Extraction | EXIF allowlist only; raw strings preserved in `raw_allowlist`; normalised into the Shooting Details value type; never stored: GPS (except an optional owner-only suggestion per D-08), serial numbers, owner/artist fields, MakerNotes, XMP/IPTC location fields. Failure never blocks the upload |
| 5. Processing | Pixel limit read from the header and checked **before** decoding; decode; apply orientation; convert colour to sRGB; re-encode variants under `variants/{assetId}/{key_version}/{kind}`; asset `ready` |
| 6. Review | Draft shows pre-filled Shooting Details with provenance; user edits (may remove capture time); optional location with an explicit mode |
| 7. Publication | One transaction: asset `ready`, terms accepted → post `published`; GPS suggestion (if any) deleted |
| 8. Delivery | Owning module authorises; Media issues signed URLs (below) |
| 9. Failure | Transient errors retry; permanent/final → asset `failed` with a user-safe code; "Retry processing" creates a new processing generation; a reconciliation job finds assets stuck in `processing` |
| 10. Hide / unhide / delete | See "Revocation" |

## Accepted formats and limits

- Slice S1: JPEG. Before the pilot gate (PQ-020b): PNG and WebP. HEIC/HEIF later (D-07).
- Maximum file size, maximum pixel count and per-user upload rate are set in PQ-020a (M-08).
- Never trust client-provided MIME type or metadata.

## EXIF allowlist → Shooting Details

| Shooting Details field | Typical EXIF source |
|---|---|
| Camera (raw text + resolved model) | Make, Model |
| Lens (raw text + resolved model) | LensMake, LensModel (vendor fallbacks vary) |
| Focal length | FocalLength |
| Aperture | FNumber |
| Shutter speed | ExposureTime |
| ISO | ISOSpeedRatings / PhotographicSensitivity |
| Exposure compensation | ExposureBiasValue |
| Flash | Flash (fired bit) |
| Capture date/time | DateTimeOriginal (+ OffsetTimeOriginal) |
| Software | Software |

Unknown values stay `null`; nothing is fabricated. Capture time without an offset is shown as local time, not as an absolute timestamp. In S1–S3 only raw equipment text is stored; the Equipment resolver (S4) fills model IDs and backfills earlier snapshots.

## Variants

- Kinds: `display_large`, `display_medium`, `thumbnail` (public kinds) and `ai_analysis` (never public; owner/admin views of hidden posts and the AI Coach).
- **Re-encoded from pixels**, never copied with tags removed. No EXIF, XMP, IPTC, comments, MakerNotes or embedded thumbnails (an embedded thumbnail can show the uncropped original). Only a compact sRGB profile may be embedded.
- Orientation: all 8 EXIF values (including mirrored) applied to pixels; no orientation tag in the variant.
- Colour: embedded ICC profile read and converted to sRGB (rendering intent chosen in the PQ-020a spike); no profile → treated as sRGB; CMYK and grayscale handled. HDR gain maps are not preserved in the MVP.
- Sizes and output format set in PQ-020a [A]; never upscale.
- **Privacy contract tests:** fixtures with GPS, XMP location, embedded thumbnails, Display P3, Adobe RGB, CMYK, grayscale and all orientations; every variant is parsed and asserted to contain no EXIF/XMP/IPTC/GPS segments and correct orientation.

## Delivery (ADR-023)

- Public variants of published, non-hidden posts: direct signed URLs, time-bucketed with B = 3600 s and lifetime L = 7200 s:
  `bucket_start = floor(now / B) * B`, `signing_time = bucket_start`, `expires_in = L` → URLs byte-identical within an hour, valid 1–2 h.
- `Cache-Control: private, max-age=3600` for public variants.
- Owner-only drafts, hidden-post views and submissions: non-bucketed 5-minute URLs, `Cache-Control: private, no-store`.
- No CDN in the pilot. Signing uses long-lived, least-privilege read-only credentials.

## Revocation

| Event | Effect |
|---|---|
| Hide (moderation) | No new public URLs immediately; job deletes public variants; original and `ai_analysis` kept; owner/admin see the `ai_analysis` variant via 5-minute URLs |
| Unhide | Public variants regenerated from the original under a new `key_version` |
| Delete (owner) / account deletion | No URLs immediately; job deletes original and all variants; DB rows purged after a retention period |
| Draft expiry (e.g. 30 days [A], Q-7) | Draft and all files deleted; the UI tells users drafts expire |
| Avatar replaced | Old avatar asset deleted |

What this does and does not guarantee:
- Hiding or deleting a photo removes it from PhotoQuest immediately; stored files are deleted shortly after, normally within about a minute (monitored target).
- After that, the image can no longer be downloaded from PhotoQuest, even with a previously issued link.
- Copies already delivered to viewers (browser cache for up to 1 h, downloads, screenshots) cannot be recalled.
- Backups may contain deleted data until they rotate (disclosed in the privacy policy).

**Emergency revocation runbook:** create and deploy new signing credentials → **disable the old credentials at the provider** → verify an old URL is refused → delete the old credentials → record the incident. Rehearsed on staging (PQ-054a).

**Provider checks in PQ-007:** past signing times accepted; byte-identical URLs; read-after-delete consistency; `Cache-Control` honoured via response-header override or object metadata; disabling a key invalidates its URLs; an upload size enforcement option (presigned POST policy or proxied upload).

## Location privacy (ADR-015)

- EXIF GPS is never public; at most an owner-only suggestion (D-08) that becomes a post point only when the author confirms it.
- A post's public location exists only through an explicit author choice of mode (exact / approximate / private); the mode limits all public geographic information.
