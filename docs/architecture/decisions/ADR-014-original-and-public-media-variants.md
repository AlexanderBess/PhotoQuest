# ADR-014: Separate Original and Public Media Variants

- **Status:** Accepted (updated 2026-11-03)
- **Decision:**
  - Original uploads are private, read only by the worker, never addressed by a URL returned to clients.
  - Variants (`display_large`, `display_medium`, `thumbnail`, `ai_analysis`) are **generated independently by decoding pixels and re-encoding**, never by copying the original and deleting tags. They contain no EXIF, XMP, IPTC, MakerNotes, comments or embedded thumbnails; only a compact sRGB profile may be embedded.
  - Orientation is applied to pixels; colour is converted to sRGB from the embedded ICC profile.
  - Variant keys include a random `key_version` per generation; a regenerated set never reuses an old key.
  - **Hide:** public variants are deleted; original and `ai_analysis` are kept. **Unhide:** public variants are regenerated under a new `key_version`. **Delete:** original and all variants are deleted.
- **Context:** Public rendering and AI processing have different requirements from original storage; hidden or deleted content must stop being downloadable.
- **Consequences:** Privacy contract tests assert that no variant contains metadata or GPS. Access control and deletion cover all variants. Storage keys are never exposed. Delivery and revocation details: ADR-023.
