# ADR-023: Storage Adapter, Media Delivery and Revocation

- **Status:** Accepted (approved 2026-11-03) — the storage provider itself remains open (D-03)
- **Decision:**
  - All object storage access goes through a platform storage adapter (put, get, delete, presign) against an S3-compatible API; a local S3-compatible service is used in development.
  - Originals and variants live in a private bucket under opaque keys, never returned by the API.
  - The owning module applies its access policy, then obtains delivery URLs from Media.
  - **Public variants of published posts:** direct signed URLs, **time-bucketed**: bucket B = 3600 s, lifetime L = 7200 s, signing time = `floor(now / B) * B`, so URLs are byte-identical within an hour and valid for 1–2 h. `Cache-Control: private, max-age=3600`. No CDN in the pilot.
  - **Owner-only and admin views** (drafts, hidden posts, submissions): non-bucketed 5-minute URLs, `Cache-Control: private, no-store`.
  - Signing uses long-lived, least-privilege read-only credentials for `variants/`.
  - **Revocation is by object deletion** (ADR-014): hide deletes public variants, delete removes all files. Stopping URL issuance is immediate; file deletion follows within about a minute (monitored target). Copies already delivered to viewers (browser cache, downloads, screenshots) cannot be recalled; documentation and the privacy policy say so.
  - **Emergency revocation runbook:** create and deploy new signing credentials, **disable the old credentials at the provider**, verify an old URL is refused, then delete the old credentials and record the incident. Rehearsed on staging.
  - **Provider compatibility checks in PQ-007:** past signing times accepted; byte-identical URLs; read-after-delete consistency; response-header overrides or object metadata honoured; disabling a key invalidates its URLs; an upload size enforcement option.
- **Context:** ADR-014 requires private originals and sanitised variants; public pages need cacheable delivery for anonymous viewers.
- **Consequences:** Provider is replaceable by configuration if it passes the checks. A future CDN requires signature-aware cache keys, TTL ≤ minimum URL validity and purge calls from hide/delete jobs.
