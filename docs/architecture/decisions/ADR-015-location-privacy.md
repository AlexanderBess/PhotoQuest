# ADR-015: Location Privacy and EXIF Sanitization

- **Status:** Accepted (updated 2026-11-03, revision 4)
- **Decision:**
  - GPS and sensitive EXIF are never present in any image variant (ADR-014) and never in any public API response, analytics, log, job payload or AI input.
  - Exact coordinates never become public automatically. EXIF GPS can at most be a private owner-only suggestion (retention: D-08), deleted on publish.
  - Each post location has exactly one **mode**:
    - **Exact** — the linked curated place and/or the author's point (rounded to ~1 m) and the label are public.
    - **Approximate** — **only an area** is public: the cell of a deterministic, metric-aware grid. No place link, no label, no place-page listing, no place filter.
    - **Private** — nothing about the location is public.
  - **The selected mode is an upper bound on precision for all public geographic information** attached to the photo, including labels, place listings, filters and counts.
  - Approximation is deterministic grid snapping (no random jitter) at one of two levels: "area" (default) or "neighbourhood" (opt-in), previewed before publishing. The public precision is the coarser of the chosen level and the linked place's own public precision. Cell sizes: D-20.
  - All geographic queries (viewport, bounding box, clustering, counts, future distance search) use only the public representation.
  - Curated locations have an editor-chosen public precision; their exact coordinates are private when precision is approximate.
- **Context:** EXIF and labels can expose homes or other sensitive places; one fixed grid is not equally private in cities and rural areas.
- **Consequences:** Enforced by allowlisted serializers and query filters in Community; tested with one invariant — no public output finer than the selected mode — for anonymous viewers and every mode. Mode changes apply immediately to new responses; already-seen data cannot be recalled.
