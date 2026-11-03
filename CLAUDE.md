# PhotoQuest — Instructions for Claude Code

## 1. Read before changing code

Before starting a task, read:
- `README.md`
- `TASKS.md`
- Relevant product documents in `docs/product/`
- Relevant architecture documents and ADRs in `docs/architecture/`
- Relevant technical specifications in `docs/`
- The decision record `docs/analysis/decision-review-2026-11-03.md` (Revision 4) for the area you touch
- Open decisions in `docs/analysis/risks-and-open-questions.md` that block the task

Do not assume undocumented product behavior. If requirements conflict, stop and report the conflict. If a task depends on an open decision listed as blocking it, ask before coding.

ADR status meaning:
- **Accepted** — follow it.
- **Proposed** — the intended design; follow it, but if implementation shows it needs to change, stop and propose an update instead of silently deviating.

Values marked **[A]** in the docs (sizes, timeouts, retention periods) are defaults: the implementing task may tune them, but must document the chosen value.

## 2. Product context

PhotoQuest is a **photography discovery and knowledge platform** for photographers of all experience levels (ADR-018). Its primary value is discovery and inspiration.

Primary loops:
- **Discover:** find photography locations on a map and in a catalog → open a location → see photos taken there → inspect their Shooting Details → save the location or photo.
- **Contribute:** upload a photo → review/correct extracted Shooting Details → optionally add a location with a chosen mode (exact, approximate, private) → publish.
- **Improve (MVP extensions):** ask the AI Coach about one of your own photos; later, learning paths and challenges.

The MVP is deliberately narrow and is built in vertical slices S0–S5 (`docs/analysis/implementation-roadmap.md`). Do not implement future modules merely because their boundaries appear in the architecture.

## 3. Technology decisions

### Frontend
- Vue 3, TypeScript (strict), Vite, Composition API
- Feature-Sliced Design, applied pragmatically
- Internationalisation from day one: Russian is the only shipped locale in the pilot; English must be addable without refactoring (ADR-024)
- Vitest and Vue Test Utils; Playwright for critical end-to-end flows

### Backend
- Go, PostgreSQL, REST API documented with OpenAPI
- Database migrations
- Background worker process (same codebase and Docker image as the API, separate `cmd/worker` entry point) using a PostgreSQL **transactional job queue** (`platform.jobs`, ADR-005, ADR-022)

### Infrastructure
- Docker Compose for local development
- S3-compatible object storage behind a storage adapter (ADR-023)
- GitHub Actions for CI
- A staging environment restricted to invited testers (from slice S1), production before the pilot gate

Exact library choices and versions must be proposed and approved (decision D-17) before adding dependencies.

## 4. Architecture rules

- Modular monolith. No microservices, Kafka, RabbitMQ, NATS or Kubernetes for the MVP.
- Keep domain logic out of HTTP handlers and persistence adapters.
- Modules expose public interfaces; other modules must not import their internals or touch their tables.
- Explicit dependency injection.
- PostgreSQL with one logical schema per module.
- Asynchronous work is enqueued in the same transaction as the domain change (ADR-022). Domain events are in-process only and are **not stored**; do not rely on event history or replay. Handlers are idempotent (at-least-once delivery, lease-token fencing).
- Provider-specific AI, storage and map code stays behind adapters.
- **Ownership rules that must not be broken:**
  - Community owns posts, post Shooting Details snapshots, post-location links and their mode (ADR-020).
  - Explore owns curated location records and their public precision; it reads photos for a place through a Community query interface that returns exact-mode posts only.
  - Media owns files, variants, storage keys and extracted metadata. **Every Media Asset belongs to exactly one owning entity** (post, submission or avatar); assets are never shared (ADR-004). An asset ID never grants access.
  - Shooting Details rules live in one shared value-type package with no persistence (ADR-021); original equipment text is always preserved next to resolved model IDs.
  - Equipment merges are edges (`merged_into_id`); aliases and historical records are never rewritten (ADR-011).
  - Coach analyses only photos the requester owns, through the owning module's authorisation; it never depends on Learning (ADR-008).
- **Authorization** (ADR-019): every use case receives a viewer context (anonymous, user, admin) and enforces its own policy. Public queries return only published, non-hidden content. Admin routes are a separate route group and admin use cases re-check the role.
- Do not create speculative abstractions without a concrete use case.

## 5. MVP boundaries (ADR-018)

**Pilot essentials** (required before the pilot gate):
- Identity (registration, login, password reset, account deletion), roles, authorization
- Profiles with unique handles and per-field visibility; Instagram link (URL/username only)
- Equipment: canonical brands/models with provisional entries; small seed list; user gear
- Media upload and processing with private originals and re-encoded, sanitised variants
- Shooting Details: EXIF extraction, review and correction before publishing
- Photo publishing, public photo page, public feed, photo bookmarks
- Explore: admin-curated locations, map (curated locations only) and list, location pages
- Photo–location links in exact / approximate / private mode
- Basic search and filtering; saved locations; Library
- Reporting, admin hide/unhide, audit log
- Terms, privacy policy, upload licence and consent before pilot users publish
- **Security, backups (with tested restore) and basic operational monitoring — mandatory**
- Analytics event capture

**MVP extensions** (may ship during the pilot; must not delay it):
- Standalone AI Coach on the user's own drafts and published posts (feature-flagged)
- Seeded learning paths and challenges, challenge submissions, challenge-context Coach feedback
- Admin screens for equipment merges and dead jobs; extra filters; link previews; GPS location suggestion; notifications beyond password reset

Public access: public photo pages, location pages, the feed and public profiles are viewable without registration in production. Publishing, saving, reporting, settings, AI Coach and learning progress require authentication.

**Staging** (until S5 and the pilot gate): invited testers only, behind an access gate; public registration disabled; no search-engine indexing; test-data and consent rules in `docs/analysis/implementation-roadmap.md` apply.

Out of scope unless explicitly approved:
- Full social networking: comments, reactions, follows, groups, messaging, events, creator tools
- User-submitted locations, external location imports, routes, weather/sun forecasts
- Multiple location roles per photo; publishing a challenge submission; AI on other users' photos; sharing AI feedback
- Academy, instructor marketplace, payments, subscriptions
- Instagram OAuth, import, publishing or insights
- Complex gamification, leaderboards, recommendation engines
- Native mobile applications
- Microservices or distributed infrastructure

## 6. Privacy rules (non-negotiable)

- Originals are private and never delivered to clients. Storage keys are never exposed.
- Variants are produced by **decoding and re-encoding**; they contain no EXIF, XMP, IPTC, MakerNotes, comments or embedded thumbnails (ADR-014).
- GPS never appears in variants, public API responses, analytics, logs, job payloads, errors or AI inputs.
- Each post location has one **mode**; the mode limits **all** public geographic information about the photo (ADR-015):
  - exact — place and/or point and label public;
  - approximate — only a deterministic grid cell; no place link, no label, no place-page listing, no place filter;
  - private — nothing public.
- Geographic queries (viewport, filters, clustering, counts) use only the public representation.
- Shooting Details are shown from structured data, never by exposing raw EXIF. Missing metadata is never fabricated.
- Revocation is by deleting stored objects. Never promise that copies already delivered to viewers can be recalled (ADR-023).
- AI feedback is private to the photo's owner.

## 7. Engineering standards

- Prefer simple, readable code over clever abstractions.
- Keep functions focused and names domain-oriented.
- Validate untrusted input at system boundaries.
- Use context cancellation and timeouts for I/O.
- Never log passwords, tokens, signed URLs, storage keys, coordinates, location labels or private image metadata.
- Store secrets in environment variables; never commit `.env`.
- Add database migrations for schema changes.
- No hard-coded user-facing strings in the frontend; use locale messages.
- Add tests for business rules, authorization, privacy invariants and error cases.
- Avoid broad refactors in feature tasks.
- Do not silently change API contracts or database semantics.
- Update relevant documentation when a decision or contract changes.

## 8. Working protocol

For each task:
1. Inspect the current repository and relevant documentation.
2. Restate the intended outcome briefly.
3. Identify assumptions, risks, blocking open decisions, and files likely to change.
4. Present a concise implementation plan before substantial changes.
5. Write or update the OpenAPI schema for any new endpoint before implementing it.
6. Implement only the approved task.
7. Run formatting, linting, tests, and relevant checks.
8. Report changed files, checks run, results, and known limitations.
9. Update `TASKS.md` and docs when appropriate.

If a requirement is ambiguous in a way that affects data model, security, privacy, user experience, or architecture, ask before coding.

Do not claim a check passed unless it was actually run. Do not hide failing tests.

## 9. Definition of done

A task is done only when:
- Acceptance criteria are met.
- Code is formatted.
- Relevant tests pass, including authorization and privacy tests for protected or public resources.
- No secrets or private user data (including GPS and non-public location data) are exposed.
- Errors are handled intentionally.
- User-facing strings are localised.
- Documentation is updated where needed.
- The final report lists verification results and any remaining risks.
