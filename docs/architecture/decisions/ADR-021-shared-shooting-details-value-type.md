# ADR-021: Shared Shooting Details Value Type

- **Status:** Accepted (approved 2026-11-03)
- **Decision:** Define Shooting Details once in a shared-kernel package (`internal/shared/shootingdetails`): fields, units, normalisation, validation ranges, display-formatting inputs and per-field provenance (`exif`, `manual`). No persistence; imports no module.
  - Equipment fields carry both the **original text** (`*_raw_text`, from EXIF or the user) and the **resolved model ID** (`*_model_id`, nullable). Resolution uses Equipment's resolver (ADR-011); the original text is never discarded.
  - Media outputs extracted values as this type; Community and Learning store their own snapshots (ADR-013) with the same column set.
  - Location is not part of Shooting Details.
- **Context:** Without a shared definition, normalisation and validation would be implemented twice and drift.
- **Consequences:** A narrow, documented shared-kernel exception. Because raw text is preserved, model IDs can be filled in later (slice S4 backfills snapshots created in S1–S3). Changes require tests in Media, Community and Learning.
