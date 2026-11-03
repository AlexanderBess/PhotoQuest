# ADR-022: PostgreSQL Jobs Table as a Transactional Job Queue

- **Status:** Accepted (approved 2026-11-03)
- **Decision:** Implement ADR-005 with one table, `platform.jobs`.

**Terminology.** This is a transactional job queue: handler jobs are inserted in the caller's transaction. Domain events are in-process values; `events.Publish(tx, event)` inserts one job per registered handler and stores nothing else. There is no persistent event history.

**Table:** `id`, `kind`, `payload` (IDs only), `dedupe_key`, `status` (`pending`, `running`, `succeeded`, `dead`), `run_after`, `attempts`, `max_attempts`, `lease_token`, `locked_until`, `last_error` (sanitised), `last_error_class` (`transient`, `permanent`), `manual_retries`, `created_at`, `updated_at`, `finished_at`. Unique (`kind`, `dedupe_key`).

**Mechanics**
- **Unique event-handler jobs:** `dedupe_key = event_id` (deterministic from the business fact where repeats are possible), inserted with `ON CONFLICT DO NOTHING` — at most one job per handler and event. Direct enqueue exists for single-consumer work (e.g. `media.process_asset:{assetId}:{generation}`).
- **Claiming:** short transaction with `FOR UPDATE SKIP LOCKED`; sets `running`, a fresh `lease_token`, `locked_until = now() + lease`, `attempts + 1`. Eligible: `pending` with `run_after <= now()`, or `running` with an expired lease. Handlers run outside the claim transaction.
- **Stale workers:** every completion/failure update is fenced with `WHERE id = $id AND lease_token = $token`; a stale worker updates nothing and stops. Optional heartbeat extends the lease.
- **Idempotency:** at-least-once delivery; handlers reload state from IDs, write deterministic outputs, use conditional state transitions; allowance consumption at most once per analysis.
- **Retries:** transient errors retry with capped exponential backoff and jitter; permanent errors fail immediately; `max_attempts` per kind.
- **Failed jobs:** final failure → `dead`, and in the same transaction `OnFinalFailure` updates domain state (asset `failed`, analysis `failed` with allowance released).
- **Manual retry:** operator requeue of a dead job (admin endpoint/CLI, audit-logged, extra attempts); user-initiated domain retry creates a new job with a new generation key.
- **Housekeeping:** ~1 s polling; succeeded rows deleted after a retention period; dead rows kept until requeued or dismissed; periodic jobs via a ticker with per-period dedupe keys.
- **Monitoring:** dead-job count, oldest pending age and error rate with alerts (pilot requirement).
- **Implementation:** hand-rolled by default; a third-party queue library only with explicit approval in the PQ-006 plan.

- **Context:** One table is enough for pilot-scale single-consumer jobs.
- **Consequences:** No event replay or history; revisit (separate `outbox_events`) only if needed.
