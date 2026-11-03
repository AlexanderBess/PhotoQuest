# Coding Standards

## General
- Optimize for clarity and maintainability.
- Prefer explicit names and small functions.
- Avoid speculative abstractions.
- Keep changes scoped to the task.
- Handle errors explicitly.
- Never commit secrets or production user data.

## Go
- Follow standard Go formatting and idioms.
- Pass `context.Context` to I/O and long-running operations.
- Keep HTTP transport, application use cases, domain logic, and persistence concerns separated.
- Use cases receive the viewer context and enforce authorization themselves (ADR-019).
- Wrap errors with useful context without leaking sensitive details.
- Use interfaces at meaningful boundaries, not for every struct.
- Job handlers must be idempotent (ADR-022): reload state from IDs, write deterministic outputs, use conditional state transitions; fence completion updates with the lease token. Do not rely on stored event history — there is none.
- Never log tokens, signed URLs, storage keys, coordinates, location labels or raw EXIF.
- Use explicit allowlisted serializers for every response; never serialize domain structs directly.
- Test business rules, authorization (anonymous / owner / other user / admin) and failure paths.

## TypeScript and Vue
- Enable strict TypeScript.
- Use Vue 3 Composition API and `<script setup>` where appropriate.
- Avoid `any`; use `unknown` and narrow types at boundaries.
- Keep components focused.
- Keep API access out of presentational components.
- No hard-coded user-facing strings; use locale messages (ADR-024).
- Format dates, numbers and Shooting Details through shared locale-aware formatters.
- Use composables for reusable behavior, not as a dumping ground.
- Avoid unnecessary global state.

## Database
- All schema changes use migrations.
- Add constraints for important invariants.
- Use transactions for multi-step state transitions; insert jobs in the same transaction.
- Add indexes based on query patterns.
- Define deletion and retention behavior.

## API
- Write the OpenAPI schema before implementing an endpoint.
- Validate inputs at the boundary.
- Use consistent error responses with stable error codes.
- Document breaking changes.
- Enforce authorization server-side.
- Make retry behavior and idempotency explicit.

## Tests
- Test behavior, not implementation details.
- Include negative cases and privacy cases:
  - privacy contract tests: no EXIF/XMP/IPTC/GPS or embedded thumbnails in any variant;
  - location invariant: no public output (fields, filters, counts, place listings) finer than the post's mode; labels public only in exact mode;
  - profile fields respect per-field visibility for anonymous and signed-in viewers;
  - equipment merges: long chains, cycles, brand merges, undo, history unchanged.
- Avoid flaky time-dependent tests.
- Use deterministic fixtures (including a set of real-world EXIF samples for normalisation tests).
