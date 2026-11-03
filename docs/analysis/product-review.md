# Product Review — PhotoQuest MVP

> **Status update 2026-11-03:** This review is the historical PQ-001 analysis. The owner has since chosen Option C (narrowed discovery-first, ADR-018), Russian UI with i18n (ADR-024), public read access (ADR-019) and three location visibility levels (ADR-015). The scope conflict described below is resolved; current decisions and open items are in `risks-and-open-questions.md`, changes in `documentation-sync-2026-11-03.md`.

- **Task:** PQ-001 (analysis input; no code)
- **Date:** 2026-11-03
- **Scope of review:** `CLAUDE.md`, `README.md`, `TASKS.md`, all of `docs/` (product, architecture, ADR-001…017, API, DB, frontend, media, AI, development).

**Legend used in all analysis documents**

| Tag | Meaning |
|---|---|
| **[C]** | Confirmed — stated in a project document (source given) |
| **[A]** | Assumption — not stated; inferred and must be confirmed |
| **[R]** | Recommendation — my proposal, not a decision |

---

## 1. Executive summary

1. **The repository contains two different MVP definitions.** One is *learning-first* (learning paths → challenge → AI Coach), the other is *discovery-first* (locations, photo feed, Shooting Details, with learning as a supporting pillar). They are not reconcilable by interpretation: `CLAUDE.md` explicitly puts "public social feed" and "Explore maps" out of scope, while `TASKS.md` Phases 2–3 require a photo feed and a location map. Per `CLAUDE.md §1` this must be resolved by the product owner before Phase 1+ work. See §2 and decision **D-01** in `risks-and-open-questions.md`.
2. The **discovery-first** scope is roughly twice the size of the learning-first scope and adds the hardest product problem in the whole plan: **content cold start** (empty map, empty feed).
3. The **shared core** (identity, profile, media upload, EXIF/Shooting Details, privacy-safe variants, admin) is identical in both directions. Phase 0 and most of Phase 1–2 can proceed regardless of D-01 — but only once D-01 is made, so the docs are aligned before data models are written.
4. For a solo developer with AI assistance, the full discovery-first MVP is **feasible only with deliberate cuts**. A narrowed version (§7) is realistic.
5. Several product requirements are missing entirely: password reset/account recovery, account deletion, UI language/localisation, anonymous vs signed-in access to discovery, rights/licence terms for uploaded photos, and how "Pro" is granted without payments.

---

## 2. Two product definitions in the repository (critical)

### 2.1 Which document says what

| Document | Direction | Evidence |
|---|---|---|
| Project description (claude.ai Project) | Learning-first | "first version should remain focused on learning and AI Photo Coach" |
| `CLAUDE.md` §2, §5 | Learning-first | Core loop = learn→practice→submit→feedback; out of scope: "Public social feed", "Explore maps and route planning" |
| `README.md` | Learning-first | Explore and Community listed as *future modules*; MVP hypothesis is about repeated exercises |
| `docs/product/user-flows.md` | Learning-first | Only learning flows; onboarding ends with "recommended learning path" |
| `docs/architecture/overview.md` | Learning-first | `explore`, `community` listed as future modules; no `explore`/`community` DB schemas |
| `docs/architecture/database-schema.md` | Learning-first | Community/Explore tables under "Future…"; "Do not create these tables in the MVP" |
| `docs/architecture/api-contracts.md` | Learning-first | No endpoints for posts, feed, bookmarks, locations, reports |
| `docs/frontend/architecture.md` | Learning-first | Routes cover learning only |
| `docs/media/media-and-exif.md`, ADR-004/011/013 | Learning-first | Refer to "future Community posts" |
| `docs/product/vision.md` | **Discovery-first** | "photography discovery and knowledge platform with learning tools"; prioritise enthusiasts |
| `docs/product/mvp-scope.md` | **Discovery-first** | Must-have: map, locations, feed, bookmarks, publishing; "Learning is one pillar, not the entire product" |
| `TASKS.md` | **Discovery-first** | Header + Phases 2–3 (PQ-022 publishing, PQ-023 feed, PQ-030–033 Explore) |
| `docs/architecture/modules.md` | **Mixed** | Explore and Community described with MVP behaviour, but labelled "future expansion" in the intro |

**Interpretation [A]:** `TASKS.md` PQ-001 refers to "the updated multi-audience vision", so the discovery-first documents are probably the *newer* intent, and `CLAUDE.md`/README/architecture were not updated. This is an assumption; the owner must confirm.

### 2.2 Why this blocks implementation

- `CLAUDE.md` is the instruction file Claude Code follows on every task. As written, it would make Claude Code refuse or push back on PQ-023 and PQ-031.
- The database schema and API contract documents have no design for posts, locations, bookmarks or reports, which are Must-haves in the discovery-first scope.
- Onboarding (`user-flows.md`) asks for *learning goals* and ends at a learning path — wrong first-run experience for a discovery product.

**[R]** Resolve D-01 first, then update `CLAUDE.md`, `README.md`, `overview.md`, `database-schema.md`, `api-contracts.md`, `frontend/architecture.md`, `user-flows.md` in one documentation-only change, with a new ADR recording the scope decision.

---

## 3. Product understanding

### 3.1 Vision (as of `vision.md`) [C]
Connect **real photographs + places + technical details + practical learning**. Distinctive value: a photo is never just an image; it carries Shooting Details and (optionally) a place, and a place carries example photos.

### 3.2 There are three loops, not one

| Loop | Steps | Who | Value to user without other loops? |
|---|---|---|---|
| **Discovery** | Search/map → location → example photos → Shooting Details → save | Enthusiasts, experienced | Yes — but only if content exists |
| **Contribution** | Upload → EXIF review → publish → (link to location) | Enthusiasts, experienced | Weak without viewers (no reactions/comments in MVP) |
| **Learning** | Path → lesson → challenge → submit → AI feedback → progress | Learners | Yes — self-contained, no cold start |

**Observation:** the learning loop is the only one that delivers value to the *first* user. Discovery depends on contribution, and contribution in the MVP has almost no reward (no likes, comments or follows). This is the central product risk of the discovery-first direction (see R-01).

### 3.3 Audiences [C `vision.md`]
Learners, enthusiasts (priority), experienced photographers. Tensions worth noting:
- Experienced photographers value **precise** locations; the privacy rules default to **coarse** locations. The product must make "share precisely" an explicit, easy choice, or the main audience gets little value.
- Enthusiasts who contribute need a reason to publish here and not only on Instagram. The Instagram link helps attribution but also sends attention away.

---

## 4. MVP scope assessment (discovery-first, as in `mvp-scope.md` + `TASKS.md`)

Effort is relative (S ≈ days, M ≈ 1–2 weeks, L ≈ 2–4 weeks of focused solo work with AI assistance) — **[A] rough estimate, not a commitment.**

| Capability | Value for pilot hypothesis | Effort | [R] Recommendation |
|---|---|---|---|
| Registration/login/sessions | Required | M | Keep. Add password reset (missing). |
| Profile + privacy + Instagram link | Medium | S | Keep. Simplify visibility to public/private. |
| Equipment catalog + user gear | Low–medium | M–L (catalog data is the cost) | **Simplify:** free-text/custom gear + small curated catalog; catalog matching optional. |
| Media upload + variants + sanitisation | Required (both directions) | L | Keep. Highest technical risk; do it early. |
| EXIF → Shooting Details + review | Core differentiator | M | Keep. |
| Publishing + post detail page | Core | M | Keep. |
| Feed + bookmarks | Medium | S–M | Keep simple: reverse-chronological, cursor pagination. |
| Locations: admin editorial | Core for discovery | M | Keep; admin-only creation in MVP. |
| Map + list + search | Core for discovery | M | Keep; map provider is an open decision (D-06). |
| Link photo ↔ location (+ precision) | Core | M | Keep; per-post precision rules must be specified (M-06). |
| Saved locations | Medium | S | Keep. |
| Learning content + admin | Medium | M | **Simplify:** content seeded via migrations/markdown files first; admin editor later. |
| Challenge submission + progress | Medium | M | Keep a thin version if D-01 keeps learning in MVP. |
| AI Coach | High cost, unproven | M–L | Keep behind entitlements; last feature before pilot. |
| Billing/entitlements Free/Pro | Low for pilot | M | **Simplify:** per-user limit with admin override; no plans UI. |
| Moderation/reporting | Required before any public UGC | M | Keep; must land before public publishing reaches pilot users. |
| Analytics | Required to evaluate pilot | S–M | Start event capture early (not in Phase 5). |

---

## 5. Hypotheses and metrics review

- **North Star (Weekly Meaningful Photography Actions)** is well chosen: it counts different actions separately and avoids vanity metrics. [C `vision.md`]
- **Targets** (30–50 participants; ≥50% second meaningful action in 14 days; ≥25% Shooting Details expansion; ≥20 location saves) are small enough to be qualitative. With 30–50 users, percentages will be noisy; treat them as signals plus interviews. [R]
- **Measurement gap:** analytics is scheduled last (PQ-051), but every metric above needs event data from the first pilot day. [R] Define the event taxonomy with each feature, and implement capture as features ship.
- **Missing metric:** content supply — photos published per contributor per week, % of locations with ≥3 example photos. Without supply, discovery metrics cannot move. [R]

---

## 6. Missing or under-specified product requirements

Detailed list with IDs in `risks-and-open-questions.md` §3. Highest impact:

1. **Product direction** (D-01).
2. **Account recovery / password reset** and email delivery — not mentioned anywhere.
3. **Account and content deletion** (user deletes account → posts, media variants, AI records, location links).
4. **UI language** — pilot is in Novosibirsk; docs are English. Russian-only, English-only or both? Affects i18n setup in PQ-002.
5. **Anonymous access** — PQ-023 says "authenticated users can browse"; `vision.md` says "free discovery". Are location/photo pages public (shareable links, SEO) or sign-in only?
6. **Content licence/terms** for user uploads (what PhotoQuest may do with photos, including sending them to an AI provider).
7. **Challenge submission vs public post** — can a challenge photo be published to the feed? Is it the same media asset?
8. **Per-post location precision** — the exact options (none / city / area / exact) and who owns them.
9. **How Pro is granted** without a payment provider in the MVP.
10. **Onboarding content** for the discovery direction (no learning goals needed?).

---

## 7. Solo-developer feasibility

- **Learning-first MVP** (README/CLAUDE.md version): realistic for one developer with AI assistance. Few cold-start problems; smaller surface.
- **Discovery-first MVP as written**: large. ~15 capabilities, three loops, two admin workflows, map integration, moderation, AI, entitlements. Feasible only with cuts.
- **[R] Narrowed discovery-first MVP** ("Option C" in `implementation-roadmap.md`):
  - Keep: identity, profile, media + Shooting Details, publishing, post detail, curated locations + map/list, photo↔location linking, bookmarks/saves, basic feed, reporting + admin hide, event capture.
  - Thin: equipment (custom-first), learning (seeded content, 1–2 paths, challenge submission), AI Coach (single provider, hard limit per user).
  - Defer: admin editor for learning content, Free/Pro plan configuration, product-feedback form (use a simple external form), comments, filters.
- AI-assisted development speeds up code generation but does **not** reduce the cost of decisions, content creation (locations, seed photos, lessons), legal review, or pilot recruitment. These are on the critical path and are not in `TASKS.md` as tasks.

---

## 8. Recommendations (product)

1. Decide D-01 (direction). If discovery-first: adopt the narrowed scope and record it in a new ADR.
2. Treat **seed content** (locations with rights-cleared photos) as a first-class workstream starting now, in parallel with Phase 0–1 engineering.
3. Give contributors a reason to publish in the MVP without building social features: a good public profile page, location pages crediting photographers, and an Instagram link on each photo.
4. Add the missing requirements (§6) to the docs before the tasks that depend on them.
5. Instrument from the first feature, not at the end.
