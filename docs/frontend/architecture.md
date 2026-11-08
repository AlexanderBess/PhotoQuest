# Frontend Architecture

## Stack

- Vue 3, TypeScript strict mode, Vite
- Vue Router
- Pinia only where shared client state is genuinely needed
- Vue I18n (Composition API mode), with locale messages precompiled at build time so the runtime needs no message compiler (strict CSP, PQ-054b)
- Images from signed URLs; if an image fails after a long-open page, reload that item's data once to get fresh URLs
- A map library behind an adapter (provider decision D-06)
- Feature-Sliced Design (FSD), applied pragmatically
- Vitest + Vue Test Utils; Playwright for critical end-to-end journeys

Dependencies and versions are proposed in PQ-002 and committed through the package lockfile.

## FSD layers

```text
src/
  app/        bootstrap, router, guards, providers, i18n setup, global styles
  pages/      route-level composition
  widgets/    substantial blocks: feed, photo card grid, shooting-details panel, location map, location list
  features/   user actions: auth, publish-photo, edit-shooting-details, set-post-location,
              bookmark-photo, save-location, search-locations, filter-photos, report-content,
              change-handle, edit-profile-visibility, ask-coach (extension), submit-challenge (extension)
  entities/   post, location, user/profile, equipment, shooting-details, submission, feedback
  shared/     ui kit, api client + generated types, i18n helpers, map adapter, formatters, config
```

Do not create a layer or slice just to satisfy a diagram.

## Routes

Public (no account needed):
- `/` — public feed
- `/photos/:postId` — photo detail with Shooting Details
- `/explore` — map + list with search/filters
- `/locations/:locationId` — location page
- `/u/:handle` — public profile; a `redirect_to` response replaces the URL with the current handle
- `/login`, `/register`, `/reset-password`
- Legal pages: terms, privacy

Authenticated:
- `/onboarding`
- `/publish` — upload → review Shooting Details → location & visibility → publish
- `/photos/:postId/edit`
- `/library` — saved photos and saved locations
- `/me` — own profile, posts and drafts
- `/settings` — profile, handle, gear, per-field visibility toggles, Instagram link, account deletion
- Extension: "Ask the Coach" panel on the owner's own draft/published photo (behind a feature flag)
- Extension: `/learning`, `/learning/:pathId`, `/lessons/:lessonId`, `/challenges/:challengeId` (access D-22), `/submissions/:submissionId`

Admin (separate lazy-loaded route group, guarded by role; the server enforces it regardless):
- `/admin/locations`, `/admin/locations/:id`
- `/admin/reports`
- `/admin/users/:id`
- Admin screens for equipment merges and dead jobs are extensions; endpoints come first

Auth-required actions on public pages (save, report, publish) open sign-in and return the user to the original route afterwards.

## Internationalisation (ADR-024)

- Russian (`ru`) is the default and only shipped locale in the pilot; fallback locale `ru`.
- Locale messages live in `shared/i18n/locales/<locale>/` split by area (common, feed, explore, publish, shooting-details, learning, errors, admin).
- No hard-coded user-facing strings in components. The ESLint rule `vue/no-bare-strings-in-template` (PQ-002) catches bare strings in templates; `pnpm i18n:check` (PQ-004, `frontend/scripts/check-i18n.ts`) fails on missing message keys, non-literal keys without an `i18n-dynamic-key` marker, keys that differ between registered locales, and Cyrillic text in script string literals or templates. Both run in CI on every pull request (`docs/development/setup.md`, "Quality gates").
- Use CLDR plural rules via `Intl.PluralRules` (Russian: one / few / many / other; fractions use `other`), e.g. "1 фотография / 2 фотографии / 5 фотографий / 1,5 фотографии".
- Dates, numbers and units via `Intl` with the active locale, exposed through Vue I18n's datetime/number formats (`d`, `n`) and shared formatters. Shooting Details formatting (f/2.8, 1/250 s, ISO 400, focal length) lives in one formatter in `entities/shooting-details`, with localisable unit labels.
- API error `code`s map to localised messages; the frontend never shows raw server messages.
- The language switcher is one shared, reusable component that lists the registered locales. Adding English or another language = adding its locale folder and registering the locale; no new switcher and no changes to individual components.
- Editorial content (locations, lessons) is Russian-only in the MVP and is not part of UI i18n.

## API client

- Centralise base URL, credentials, error normalisation, and request cancellation in `shared/api`.
- Types generated from OpenAPI (workflow D-05).
- No direct `fetch` from arbitrary components.
- Handle 401/403/404/409/422/429 and server errors intentionally; 401 on a public page is not an error state.

## State management

- Local component state for local UI.
- Pinia for session/viewer state and genuinely shared state.
- Server data has explicit loading, success, empty, and error states.
- Avoid duplicating server state across stores.

## Map adapter

- `shared/map` exposes a small interface (render map, markers, clustering, viewport events, approximate-area rendering).
- Pages and widgets depend on the adapter, not on the provider SDK, so the provider (D-06) can be replaced.
- The map never receives exact coordinates that the API did not return publicly.
- Approximate locations are rendered as an area (the cell), never as a pin, at every zoom level.
- The MVP map shows curated places only (D-23); author points appear only on the photo page in exact mode.

## UI principles

- Mobile-responsive from the beginning.
- Photographs presented clearly and at good quality using responsive variants (`srcset`).
- Accessible labels, keyboard navigation, visible focus.
- Upload/processing progress and AI analysis status are visible.
- Shooting Details: compact summary + expandable full view; missing values shown explicitly as missing.
- The location step offers three plain-language choices — "Show the place", "Show only the general area", "Don't show the location" — with a preview of exactly what others will see; it states that labels are visible only with "Show the place" and that already-seen data cannot be recalled.
- Private-by-default profile fields show "only you can see this" next to their toggle.
- Empty states guide the next action (especially empty locations: invite to publish).
- AI feedback is scannable and never presented as an absolute score.

## Public pages and sharing

The app is a SPA. Link previews (Open Graph) and search indexing of public photo/location pages require server-rendered or pre-rendered metadata; this is decision D-18 and is not assumed.

**Staging:** the SPA shell includes `<meta name="robots" content="noindex, nofollow">` (set by the build-time flag `VITE_ROBOTS_NOINDEX`; staging and production are separate builds), registration UI is replaced by invite redemption, and the site sits behind the access gate. Production configuration must not inherit these flags.

## Testing priorities

- Route guards and the sign-in-and-return flow from public pages.
- Publish flow: upload states, Shooting Details review/edit, location visibility choice, publish.
- Location mode rendering: exact / approximate (area only, no place, no label) / private (nothing).
- Handle redirect from an old handle; per-field profile visibility.
- Feed and location pages: loading, empty, error, unavailable.
- Bookmark/save toggles.
- Explore search and filters.
- (Extensions) Coach request and feedback states; challenge submission.
- Usage-limit messaging.
- i18n: no missing keys in `ru`; plural forms.
