# ADR-013: Shooting Details as Domain Snapshot

- **Status:** Accepted (updated 2026-11-03)
- **Decision:** Store Shooting Details separately from the main post/submission record and snapshot values at creation, editable by the author.
- **Context:** Camera settings and equipment are part of a photograph's context but must not be coupled to current profile state.
- **Consequences:** Community stores `community.post_shooting_details`; Learning stores `learning.submission_shooting_details`. Both use the shared value type from ADR-021. Profile equipment changes never mutate these snapshots. Location is not part of Shooting Details (ADR-015, ADR-020).
