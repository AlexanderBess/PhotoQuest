# Risks, Missing Requirements and Open Decisions

- First written: 2026-11-03 (PQ-001). **Updated: 2026-11-03** after decision record Revision 4 (see `documentation-sync-2026-11-03-r4.md`).
- Tags: **[C]** confirmed in docs · **[A]** assumption · **[R]** recommendation. Options are options, not decisions.

---

## 1. Decision register

### 1.1 Decided

| ID | Decision | Outcome | Record |
|---|---|---|---|
| D-01 | Product direction | Narrowed discovery-first; tiers pilot essentials / extensions / future; vertical slices S0–S5 | ADR-018 |
| D-09 | Challenge submissions | Private and separate from posts; no publish-submission; own Media Assets | ADR-004, `mvp-scope.md` |
| D-10 | UI language | Russian pilot; i18n-ready for English | ADR-024 |
| D-12 | Anonymous access | Public photos, feed, places, profiles viewable in production; staging invited testers only | ADR-019 |
| D-19 | Profile privacy | Per-field visibility: bio and Instagram default private, equipment default public, experience level private | ADR-019 |
| D-23 | MVP map content | Curated places only; author points on the photo page in exact mode | ADR-020 |
| D-24 | Public profile URL | Superseded: unique handles with permanent redirects, never reassigned | ADR-019 |
| — | Location privacy | Modes exact / approximate / private; the mode limits all public geography; labels public only in exact mode | ADR-015 |
| — | GPS | Never public automatically; never in any variant or public output | ADR-014, ADR-015 |
| — | Shooting Details | Reviewed before publishing; original equipment text preserved | ADR-021 |
| — | Equipment | Canonical models, provisional entries, merges as edges with depth limit at creation and exact undo | ADR-011 |
| — | AI Coach | Standalone on own posts; private; independent of Learning; extension | ADR-008 |
| — | Jobs | Transactional job queue; no stored event history | ADR-005, ADR-022 |
| — | Media delivery | Time-bucketed signed URLs; revocation by deleting objects; emergency rotation disables old credentials | ADR-014, ADR-023 |

All ADRs ADR-001 … ADR-025 are Accepted (decision record Revision 4, 2026-11-03).

### 1.2 Open — ordered by slice

| ID | Decision | Blocks | Needed by | Options | [R] Recommendation |
|---|---|---|---|---|---|
| D-17 | Toolchain versions, package manager, Go router / DB access / migration tool, frontend libraries | PQ-002 | S0 | — | Partly decided 2026-11-03: Go 1.27, Node 26 LTS, pnpm, Task, TypeScript 6.0, Vue 3.5, Vite 8, Vue I18n. Implemented in PQ-002 (2026-11-08): Go 1.27.3, Node 26.13.0, pnpm 12.15.0, Task 3.54.0, golangci-lint 2.15.0; frontend packages pinned to exact versions in `frontend/package.json` and `pnpm-lock.yaml`. Owner-approved additions to the plan: `jiti` dev dependency (ESLint needs it to load `eslint.config.ts`) and `frontend/pnpm-workspace.yaml` (pnpm 11+ settings; denies the `esbuild` install script), which replaces the planned `.npmrc`. Router, DB access and migrations → PQ-005; local S3 → PQ-007; PostgreSQL version → PQ-003 |
| D-05 | OpenAPI workflow | PQ-005 | S0 | Spec-first + generated types · code-first | Spec-first; generate Go interfaces and TS types |
| D-03 | Storage provider; upload size enforcement (delivery decided) | PQ-007 checks, PQ-020a, PQ-054a | S1 | Any S3-compatible provider passing the PQ-007 checks; presigned PUT vs POST policy vs proxied upload | Choose with hosting (D-11) |
| D-04 | Authentication mechanism, CSRF approach | PQ-010a | S1 | Server-side sessions + HTTP-only cookie · JWT access/refresh | Server-side sessions |
| D-16 | Password hashing | PQ-010a | S1 | argon2id · bcrypt | Either; document |
| D-07 | Image library; formats | PQ-020a | S1 | cgo-based (e.g. libvips bindings) · pure Go | Decide in the PQ-020a spike |
| D-08 | GPS retention for location suggestions | PQ-020a, PQ-032 | S1 | Discard at extraction · private owner-only suggestion until publish | Discard unless the suggestion UX is wanted |
| M-08 | Upload limits (size, pixels, rate) | PQ-020a | S1 | — | Set from pilot camera files in the spike |
| D-11 | Hosting / deployment target | PQ-054a (affects D-02, D-03, R-07) | **S1** | VPS + Compose · managed PaaS · regional cloud | Decide early; staging deploys in S1 |
| D-06 | Map tiles / provider | PQ-031 | S3 | Commercial SDKs · OpenStreetMap-based tiles · regional providers | Licence, coverage, cost, anonymous traffic |
| D-20 | Cell sizes for "area" and "neighbourhood" | PQ-032 | S3 | e.g. ~5 km / ~1 km [A] | Confirm in the PQ-032 plan |
| D-15 | Seed equipment list contents | PQ-012 | S4 | — | Common bodies/lenses in the pilot community |
| D-21 | Password-reset delivery channel | PQ-010b | S5 | Email provider · manual admin reset for the pilot | Email if available in the hosting region |
| D-13 | Analytics implementation | PQ-014 | S5 | Own events table · self-hosted tool · SaaS | Own events table |
| Q-7 | Draft expiry and abandoned-upload retention | PQ-020b, PQ-022 | S5 | e.g. 30 days / 24 h [A] | Confirm in the task |
| D-14 | AI allowance values | PQ-043 | E1 | Fixed default + admin override | Fixed default |
| D-02 | AI provider | PQ-042a | E1 | Vision-capable provider available in the region with acceptable data terms | Check availability early (R-07) |
| D-22 | Learning pages public or sign-in only | PQ-040 | E2 | Public read · sign-in required | Sign-in required |
| D-18 | Link previews / SEO for public pages | Extension | E3 | Accept SPA limits · server-rendered meta · pre-rendering | Accept SPA limits for the pilot |
| R-07 | Legal review: personal-data residency, AI data transfer | PQ-053, PQ-054b, D-02, D-11 | Pilot gate | — | Start early |

## 2. Risk register

L = likelihood, I = impact.

### Product
| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R-01 | Content cold start: empty map/feed. | H | H | Seed locations and rights-cleared photos; recruit contributors first; content-supply metric. |
| R-02 | Scope too large for one developer. | M (reduced by Option C) | H | Phase gates; supporting features last; defer P2 items. |
| R-03 | Docs conflict misleads implementation. | L (resolved) | M | Keep CLAUDE.md and ADRs current; change log per sync. |
| R-04 | Contributors don't publish without social rewards. | M | H | Attribution, public profiles, Instagram link, location credit; interviews. |
| R-05 | AI feedback generic or wrong. | M | M | Rubrics; reports; small evaluation set. |
| R-06 | Small pilot sample. | H | L | Combine metrics with interviews. |

### Legal / privacy
| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R-07 | Personal-data residency and cross-border transfer: pilot users in Russia; Russian personal-data law (152-FZ) includes localisation requirements; sending photos to a foreign AI provider is a cross-border transfer. [A — needs legal verification] | M | H | Legal advice before D-11 and D-02; disclosure and consent (PQ-053). |
| R-08 | Location privacy failure (incl. labels, place links, geo queries). | M | H | Re-encoded variants; mode limits all public geography; labels public only in exact mode; invariant tests (PQ-032). |
| R-09 | Rights to seed photos/uploads unclear. | M | M | Upload licence in terms; rights-cleared seed content only. |
| R-10 | Sensitive locations promoted as photo spots. | M | M | Editorial review; location reports. |
| R-21 | Public pages increase scraping and abuse exposure. | M | M | Rate limits on public endpoints; no exact coordinates unless chosen; moderation before pilot. |

### Technical
| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R-11 | Image pipeline issues (orientation, colour, memory, cgo). | H | M | PQ-020a spike with real files; privacy contract and golden-file tests. |
| R-12 | EXIF inconsistency across vendors. | H | M | Fixture set; never fabricate. |
| R-13 | AI provider availability/cost/regional restrictions. | M | H | Adapter; hard caps; early check. |
| R-14 | Duplicate jobs / double usage charging. | M | M | Idempotent handlers; reserve/consume/release. |
| R-15 | Map provider licence/cost/coverage. | M | M | Frontend adapter; evaluate before PQ-031. |
| R-16 | Admin endpoints before authorization model. | L (resolved by ordering) | H | PQ-013 in S1, before any admin endpoint. |
| R-17 | Large unreviewed AI-generated changes. | M | M | Small tasks, plan-first, CI gates. |
| R-22 | Explore ↔ Community interface coupling creates a package cycle. | M | L | Consumer-declared interfaces wired in `app/` (ADR-020). |
| R-23 | Russian text search quality. | M | L | Test search with Russian names early in PQ-034. |

### Operational
| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R-24 | Staging exposed publicly or indexed before S5 safeguards exist. | M | H | Access gate, invite-only registration, noindex headers verified in PQ-054a; test-data and consent rules. |
| R-25 | Signed-URL behaviour differs by provider (signing time, determinism, delete consistency, key disabling). | M | M | Automated provider checklist in PQ-007, run again in PQ-054a. |
| R-18 | No tested backups. | M | H | Restore test in PQ-054b, required by PQ-052. |
| R-19 | Moderation load. | L | M | Invite-only pilot. |
| R-20 | Users locked out without reset channel. | M | M | D-21. |

---

## 3. Missing requirements — status

| ID | Requirement | Status |
|---|---|---|
| M-01 | Password reset | PQ-010b; channel D-21 |
| M-02 | Account deletion/retention | PQ-010b; handle reserved without personal data |
| M-03 | UI language | Decided (ADR-024) |
| M-04 | Anonymous access | Decided (ADR-019) |
| M-05 | Terms, licence, AI consent | PQ-053 |
| M-06 | Location precision options | Modes and two levels decided; cell sizes D-20 |
| M-07 | Profile visibility semantics, experience levels | D-19 decided (per-field); experience level values in PQ-011 |
| M-08 | Upload limits | PQ-020a |
| M-09 | Post editing rules | Defined: Shooting Details, caption, location editable after publish (consistent with original PQ-021 "before or after publishing") |
| M-10 | Feed ordering/pagination | Proposed: reverse-chronological, cursor pagination |
| M-11 | Location data fields | Defined in DB model; category list = seed data |
| M-12 | Challenge retry policy | PQ-041 |
| M-13 | AI limits and failure policy | Failure releases allowance (decided); values D-14 |
| M-14 | Discovery onboarding | Defined in `user-flows.md` |
| M-15 | Discovery user flows | Added to `user-flows.md` |
| M-16 | Event taxonomy | PQ-014 |
| M-17 | Audit log fields | Defined (`platform.audit_log`) |
