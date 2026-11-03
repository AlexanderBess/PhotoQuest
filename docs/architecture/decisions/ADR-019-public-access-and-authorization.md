# ADR-019: Public Read Access, Profiles and Authorization Model

- **Status:** Accepted (updated 2026-11-03)
- **Decision:**
  - Published, non-hidden photos, the feed, published locations, location pages and public profiles are viewable without registration. (Staging is an exception: it is restricted to invited testers by an access gate; see the roadmap.)
  - Publishing, saving, reporting, settings, learning progress and AI Coach require authentication.
  - **Public profiles use per-field visibility**, identical for anonymous and signed-in viewers:
    - Always public: handle, display name, avatar (if set), published photos.
    - Toggle, default public: equipment.
    - Toggle, default private: biography, Instagram link.
    - Private in MVP: experience level.
    - Never public: email, drafts, saved items, AI feedback, learning progress.
  - **Handles** are unique public identifiers separate from display names: lowercase `a–z`, `0–9`, `_`, 3–30 characters, starting with a letter; reserved words; change allowed every 30 days; old handles redirect permanently and are never reassigned; handles of deleted accounts stay reserved without personal data.
  - Every request has a viewer context (anonymous, user, admin). Each use case enforces its own policy; public queries filter by status, visibility and location mode in the query itself.
  - Admin endpoints live under `/api/v1/admin`, require the admin role, re-check it in use cases, and audit-log important actions.
  - Ownership is derived from the viewer context, never from client-supplied IDs.
- **Context:** Public pages enable discovery and sharing but increase exposure; a single "private profile" switch would promise privacy it cannot deliver because public photos always show their author.
- **Consequences:** Authorization tests cover anonymous, owner, other user and admin. Public endpoints are rate-limited. Link previews/SEO are a separate decision (D-18). The authentication mechanism is D-04.
