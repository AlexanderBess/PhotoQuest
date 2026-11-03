# ADR-008: Standalone AI Coach with Provider Abstraction

- **Status:** Accepted (scope updated 2026-11-03)
- **Decision:**
  - Keep AI orchestration in a Coach module and isolate provider-specific implementations behind an interface.
  - The Coach analyses **a photo the requesting user owns** — in the MVP, the user's own draft or published post. It is **independent of Learning and Challenges**.
  - An analysis has a **subject** (`subject_type`: `post` now, `submission` later) and a **context**: `general` (focus + optional question, using general focus rubrics owned and versioned by Coach) or, later, `challenge` (objective and rubric supplied by Content/Learning through an optional interface). Dependency direction: Learning/Content → Coach, never Coach → Learning.
  - Feedback is **private** to the photo's owner. No sharing in the MVP.
  - The owning module (Community) authorises the request; Coach never accepts a client-supplied asset ID on its own authority.
  - One server-side allowance across all entry points.
  - The Coach is an **MVP extension** behind a feature flag; it does not block the pilot.
- **Context:** Model vendors, costs and capabilities change; the product goal is to help photographers understand and improve their photographs, not only challenge submissions.
- **Consequences:** Store provider, model, prompt version, usage and outcome; validate structured output. Never send location data, GPS, raw EXIF or unnecessary profile data to a provider. See `docs/ai/coach-specification.md`.
