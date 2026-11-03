# ADR-025: Moderation Module and Reports

- **Status:** Accepted (approved 2026-11-03)
- **Decision:** A small Moderation module owns user reports (`target_type`, `target_id`, reason, status, resolution). Resolution actions call the owning module's use cases (`community.HidePost`, `explore.UpdateLocation`, etc.); Moderation never edits other modules' data. Admin actions are recorded in `platform.audit_log`.
- **Context:** Public user-generated photos must not reach pilot users without report and hide capabilities. Admin owns no domain tables.
- **Consequences:** Moderation (PQ-050) is built in slice S5, before the pilot gate; until then only invited testers use staging. Hiding a post deletes its public image variants (ADR-014).
