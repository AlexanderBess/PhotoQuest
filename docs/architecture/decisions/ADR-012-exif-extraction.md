# ADR-012: Best-Effort EXIF Extraction

- **Status:** Accepted
- **Decision:** Extract an allowlist of useful EXIF fields asynchronously or as part of media processing.
- **Context:** Metadata may be absent, stripped, malformed, or inconsistent.
- **Consequences:** EXIF extraction never blocks upload. Users can review and correct details manually.
