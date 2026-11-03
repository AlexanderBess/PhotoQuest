# ADR-004: Shared Media Module

- **Status:** Accepted (updated 2026-11-03, revision 4 decisions)
- **Decision:** Centralize media asset lifecycle, storage, variants, and metadata extraction in the Media module.
- **Context:** Community posts, learning submissions and avatars all use images; future Academy content may too.
- **Rules:**
  - **Every Media Asset belongs to exactly one owning entity** (`owner_entity_type` + `owner_entity_id`: post, submission or avatar). Assets are never shared between entities; using the same photo twice means uploading it again (or, in future, a server-side copy that creates a new asset).
  - The owning module decides who may view an asset's variants, then requests delivery URLs from Media. An asset ID is never a permission.
  - Coach does not own assets; it reads the owning entity's `ai_analysis` variant through the owner's authorisation.
- **Consequences:** Deletion, moderation hide and access control affect only the owning entity. Storage duplication is accepted (negligible at pilot scale). See ADR-014 and ADR-023.
