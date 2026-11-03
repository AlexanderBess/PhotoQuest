# ADR-005: Internal Events and Transactional Job Queue

- **Status:** Accepted (wording corrected 2026-11-03; implementation in ADR-022)
- **Decision:** Reliable asynchronous work is created transactionally: job rows are inserted in the same PostgreSQL transaction as the domain change that causes them. Internal "domain events" are an in-process dispatch mechanism that turns an event into handler jobs inside that transaction.
- **Context:** Media processing, file deletion and AI analysis must not depend on long-running HTTP requests and must happen only if the triggering transaction commits.
- **What this is not:** there is **no persistent domain-event history**. Events are not stored, cannot be replayed, and a handler added later does not receive past events. This is accepted for the MVP. If an event history is needed later, an `outbox_events` table can be added behind the same publish API.
- **Consequences:** Handlers are idempotent and retry-safe (at-least-once delivery). No external message broker is required.
