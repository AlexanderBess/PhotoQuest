# ADR-020: Ownership and Shape of Photo–Location Relationships

- **Status:** Accepted (approved 2026-11-03)
- **Decision:**
  - Community owns the link between a post and a location: `community.post_locations`, a **separate entity with its own ID**, holding the referenced curated location, an optional author point, the derived approximate cell, an optional label, the **mode** (`exact`, `approximate`, `private`, ADR-015) and a **role**.
  - MVP: one link per post with `role = 'primary'`, enforced by `UNIQUE (post_id, role)`. Future roles (e.g. `shooting_point`, `subject`) are added as new role values without redesign; the API would add a `locations` array next to the single `location`.
  - Explore owns curated location records, their exact and public coordinates, public precision and status.
  - Community validates location references through `explore.GetPublishedLocation`. Explore lists photos for a place through `community.ListPublicPostsForLocation`, which returns **only exact-mode**, published, non-hidden posts.
  - Archived locations remain referenced by existing posts but disappear from discovery.
- **Context:** Ownership was ambiguous in the earlier docs; the author's mode is post data, so a single owner enforces location privacy.
- **Consequences:** Two narrow interfaces between Explore and Community, wired in `app/` with consumer-declared interfaces to avoid package cycles. The MVP map shows curated locations only (D-23); author points appear only on the photo page in exact mode.
