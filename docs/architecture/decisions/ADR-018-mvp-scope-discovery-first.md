# ADR-018: Narrowed Discovery-First MVP

- **Status:** Accepted (product owner decisions 2026-11-03; scope tiers and delivery order updated with revision 4)
- **Decision:** PhotoQuest's MVP is a photography discovery platform for all experience levels.
- **Pilot essentials:** profiles (handles, per-field visibility) and equipment; photo publishing, public feed and photo pages; Shooting Details with EXIF extraction and review; Explore map with curated locations; photo–location linking with exact/approximate/private modes; basic search and filtering; saving photos and locations; basic moderation; privacy and legal; **security, backups and basic operational monitoring (mandatory)**; analytics capture.
- **MVP extensions (may ship during the pilot):** standalone AI Coach (feature-flagged); Learning paths, challenges and challenge-context feedback; admin screens for equipment merges and dead jobs; extra filters; link previews; GPS location suggestion; notifications beyond password reset.
- **Out of scope / future:** full social networking, messaging and groups, user-submitted locations and imports, routes and forecasts, multiple location roles per photo, Academy/marketplace, payments, complex gamification, Instagram API, native apps.
- **Delivery order:** vertical slices S0–S5 (see `docs/analysis/implementation-roadmap.md`), then the pilot gate. AI Coach and Learning do not delay the first pilot. Before S5 is complete, only invited testers may use the staging environment.
- **Context:** The repository originally contained two conflicting MVP definitions; see `docs/analysis/product-review.md` and `decision-review-2026-11-03.md`.
- **Consequences:** Explore and Community are MVP modules; Coach and Learning are MVP extensions; future modules stay reserved but unimplemented.
