# MVP Scope

Direction: **narrowed discovery-first** (ADR-018). Scope tiers and delivery order approved 2026-11-03 (decision record Revision 4).

## MVP objective

Validate whether photographers repeatedly use PhotoQuest to discover useful shooting locations, learn from real photographs and their Shooting Details, and contribute their own work. Secondarily, test whether a standalone AI Coach and light learning challenges add value.

The MVP must be useful to people who never use the AI Coach or take a course.

## MVP audience and pilot

- Photography enthusiasts first; useful to learners and experienced photographers.
- Pilot in Novosibirsk and nearby areas. The product model must not hard-code one city.
- UI language: **Russian** for the pilot; the frontend is i18n-ready so English can be added without refactoring (ADR-024). Editorial content is Russian-only in the MVP.

## Scope tiers

| Tier | Meaning |
|---|---|
| **Pilot essentials** | Required before the pilot gate (PQ-052) |
| **MVP extensions** | Part of the MVP; may ship during the pilot; must not delay it |
| **Future** | Not in the MVP |

## Access model (ADR-019)

| Without an account (production) | Requires an account |
|---|---|
| Public feed | Publishing, editing, deleting own photos |
| Published photo pages and their public Shooting Details | Saving photos and locations; Library |
| Explore map, location list, location pages | Reporting content |
| Public profiles (by handle) | Profile, gear, privacy settings |
| Basic search and filtering | AI Coach, learning progress, challenge submissions |

Admin functions require the admin role. **Staging** is reachable only by invited testers (see the roadmap).

## Pilot essentials

### Identity and profiles
- Registration, login, logout, password reset (manual admin fallback if no email channel, D-21), account deletion.
- **Handle:** unique public identifier separate from the display name — lowercase `a–z`, `0–9`, `_`, 3–30 characters, starting with a letter; reserved words; changeable every 30 days; old handles redirect permanently and are never reassigned.
- Profile: display name, avatar, bio, experience level, Instagram link (URL/username, no OAuth).
- **Per-field visibility** (same for anonymous and signed-in viewers):

| Field | Visible to others | Default |
|---|---|---|
| Handle, display name, avatar | Always | Public |
| Published photos | Always (per-photo location mode applies) | Public |
| Equipment | Toggle | Public |
| Biography | Toggle | Private |
| Instagram link | Toggle | Private |
| Experience level | Never in MVP | Private |
| Email, drafts, saved items, AI feedback, learning progress | Never | Private |

- Skippable onboarding: handle, experience level, optional gear, optional Instagram link.

### Equipment
- Canonical brands and models with aliases; unknown names create **provisional** models; provisional models are verified only by an admin.
- Original EXIF and user-entered names are always preserved.
- Small hand-curated seed list; equipment is optional and never blocks publishing.

### Media and Shooting Details
- JPEG first; PNG and WebP before the pilot gate; HEIC later (D-07).
- Originals private; variants re-encoded without any metadata; orientation applied; colour converted to sRGB.
- EXIF extracted best-effort: camera, lens, focal length, aperture, shutter speed, ISO, exposure compensation, flash, capture date/time, software. Serial numbers and location metadata are never stored (GPS only as an optional private suggestion, D-08).
- Users **review and edit Shooting Details before publishing** and may edit them afterwards. Missing values are shown as missing, never fabricated.

### Photo publishing and discovery
- Draft → review → publish with title/caption and attribution.
- Public photo page with compact and expanded Shooting Details.
- Public, reverse-chronological, cursor-paginated feed; save/unsave photos.

### Explore and photo locations
- Admin-curated locations with category, description, practical notes and public precision.
- Map (curated locations only, D-23) and list; location pages listing exact-mode photos linked there; save/unsave locations.
- Each photo has at most one primary location link with one **mode** (ADR-015):

| Mode | What others see |
|---|---|
| **Exact** | The linked place and/or the author's point, and the label |
| **Approximate** | Only an area (a grid cell; "area" level by default, "neighbourhood" opt-in, previewed) — no place name, no label, not listed on place pages |
| **Private** | Nothing |

- The selected mode limits **all** public geographic information about the photo. EXIF GPS never becomes public automatically.

### Search and filtering (basic)
- Locations: name search (Russian), category, map viewport.
- Photos: filter by location (exact-mode links), camera and lens (merge-aware).

### Moderation, legal and operations
- Reports on photos, Shooting Details, locations, profiles and AI feedback; admin hide/unhide; audit log.
- Hiding or deleting a photo removes it immediately; stored files are deleted shortly after. Copies already delivered to viewers cannot be recalled.
- Terms of use, privacy policy, upload licence and AI-processing disclosure accepted before publishing.
- **Security:** HTTPS, secure sessions and CSRF protection, rate limits, upload validation, authorization tests, least-privilege credentials, security headers, dependency scanning.
- **Backups:** automated off-server database backups, object-storage protection, tested restore.
- **Monitoring:** uptime, error-rate alerts, job-queue health, resource usage, backup alerts.
- Analytics event capture and pilot metric queries.

## MVP extensions

- **AI Photo Coach (standalone, feature-flagged):** analyse one of your own drafts or published photos with a chosen focus (composition, light & exposure, technical quality, overall) and an optional question. Feedback is private: strengths, 2–3 prioritised improvements, a next exercise. Server-enforced allowance.
- **Learning:** seeded paths, lessons and challenges (no admin editor); private challenge submissions separate from posts; challenge-context Coach feedback using the same engine.
- Admin screens for equipment merges/verification and dead jobs; extra filters (focal length, aperture), collections; link previews (D-18); EXIF-GPS location suggestion (D-08); notifications beyond password reset.

## Future (not in the MVP)

- Comments, reactions, follows, groups, events, messaging, creator tools.
- User-submitted locations, external location imports, route planning, weather and sun forecasts.
- Multiple location roles per photo.
- Publishing a challenge submission; AI review of other users' photos; sharing AI feedback.
- Academy, instructor marketplace, payments, subscriptions, Pro plans.
- Instagram OAuth, import, cross-posting, insights.
- Native apps; complex gamification; recommendation engines; custom AI models.

## MVP content and seed data

- Seed locations in Novosibirsk and nearby areas with safe public precision and practical notes.
- Seed photographs only with clear rights and attribution.
- Seed equipment list and (for the extension) learning content as version-controlled data.
- Content creation runs in parallel with engineering.

## Pilot validation

Run a manually supported pilot; recruit contributors first so discovery users find content.

Questions:
- Do users find relevant locations and save them?
- Do users open Shooting Details and find them useful?
- Are users willing to publish photos with structured technical details and a location mode?
- Does linking photos to places create value for viewers and contributors?
- Which segment returns most often, and why?
- Does the AI Coach (and later Learning) improve retention? Introducing them during the pilot gives a before/after comparison.

Experimental targets (not forecasts): 30–50 participants; ≥50% second meaningful action within 14 days; ≥25% of photo viewers expand Shooting Details; ≥20 useful location saves; content supply tracked (photos per contributor, places with ≥3 exact-mode photos).

## Release gate

Do not expand into social features, Academy, advanced planning, or external integrations until the pilot shows repeat usage and a clear value proposition.
