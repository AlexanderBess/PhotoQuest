# ADR-011: Canonical Equipment Model with Provisional Entries

- **Status:** Accepted (rewritten 2026-11-03)
- **Decision:**
  - Equipment owns canonical **brands** and **models** (cameras, lenses), **immutable aliases** and **provisional** models. No large external catalog; a small hand-curated seed list.
  - Input text (EXIF or user-entered) is normalised into an alias key built from brand text and model text. A known key resolves to its model; an unknown key creates a provisional model and alias, so identical spellings converge automatically.
  - **Provisional models never become verified automatically**; verification is an audit-logged admin action.
  - **Original EXIF strings and user-entered names are always preserved** next to the resolved model ID.
  - **Merges are edges:** merging S into T only sets `S.merged_into_id = T`. Aliases never move; history is never rewritten. Chains are allowed; the **maximum chain depth is enforced when a merge is created**, cycles are rejected at merge time, and merges lock the involved rows. **Undo** clears the edge and restores the previous state exactly. Brands merge the same way and never affect aliases or models.
  - Search and filtering resolve merge chains (`ModelsResolvingTo`, `ResolveEffective`).
- **Context:** Different naming conventions cause duplicate models and fragmented filters; Shooting Details appear on posts (core) and submissions (extension); future Gear Explorer may reuse the data.
- **Consequences:** Users are never forced to choose a catalog entry. Posts and submissions keep snapshots (ADR-013, ADR-021). Required tests: long chains, cycles, brand merges, undo, history preservation.
