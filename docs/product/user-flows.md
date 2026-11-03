# Core User Flows

Flows are listed in product priority order (ADR-018). "Visitor" = not signed in; "User" = signed in. In staging, every flow is available only to invited testers.

## 1. Browse without an account

1. Visitor opens PhotoQuest and sees the public feed.
2. Visitor opens a photo: image, author attribution (display name, handle, avatar), compact Shooting Details, and location information allowed by the photo's mode.
3. Visitor expands Shooting Details.
4. Visitor opens Explore (map/list), searches or filters places, opens a place page with its exact-mode photos.
5. Visitor opens an author's profile at `/u/{handle}`; an old handle redirects to the current one.
6. When the visitor tries to save, publish, report or use the Coach, they are asked to sign in or register and are returned to the same place.

## 2. Registration, onboarding, recovery

1. Visitor registers (production) or redeems an invite (staging; public registration disabled there).
2. User chooses a handle (availability check, suggestions).
3. Onboarding (every step skippable, resumable): experience level, optional camera/lens, optional Instagram link.
4. User returns to where they started (or the feed).
5. Forgotten password: single-use, time-limited reset (channel D-21); existing sessions revoked.

## 3. Find a place to shoot

1. User opens Explore (map shows curated places only).
2. Searches by name, filters by category, pans the map.
3. Opens a place: description, practical notes, exact-mode photos.
4. Inspects Shooting Details of photos there.
5. Saves the place; it appears in the Library.

## 4. Publish a photograph

1. User starts "Publish" and uploads an image.
2. Upload is validated; a draft is created; processing status is shown.
3. Extracted Shooting Details are pre-filled; missing values marked; equipment shown by canonical name if verified, otherwise as found.
4. User reviews and corrects Shooting Details (may remove the capture time).
5. User adds a title/caption.
6. Optional location step, in plain language:
   - **"Show the place: [place]"** — exact mode, curated place only;
   - **"Show only the general area"** — approximate mode, with a preview of the visible cell ("area" by default, "neighbourhood" opt-in with a warning);
   - **"Don't show the location"** — private mode;
   - placing a personal point is a separate action; showing it publicly requires exact mode and confirmation;
   - an optional label is shown to others only in exact mode (the UI says so).
7. User accepts terms/upload licence if not yet accepted.
8. User publishes. The photo appears in the feed and on the profile; on a place page only in exact mode.
9. Later the user can edit caption, Shooting Details and location mode (changes apply immediately; already-seen data cannot be recalled) or delete the photo.

If processing fails, the draft shows a recoverable error with "Retry processing" or "Upload another file". Nothing is published with unreviewed Shooting Details.

## 5. Save photos and places

1. User saves a photo or a place.
2. The Library lists saved photos and saved places.
3. A saved photo that was hidden or deleted shows as unavailable.

## 6. Manage profile and privacy

1. User opens Settings → Profile.
2. Edits display name, avatar, bio, Instagram link; toggles visibility of bio (default private), equipment (default public), Instagram (default private). Each private field shows "only you can see this".
3. Changes the handle (once per 30 days); the old handle keeps redirecting.
4. Deletes the account: profile, photos and files are removed; the handle stays reserved without personal data.

## 7. Report a problem and moderation

1. User reports a photo, Shooting Details, a location, a profile or AI feedback.
2. Admin reviews and hides/unhides content, fixes location data, or resolves/dismisses the report; actions are audit-logged.
3. Owner of a hidden photo sees it with a notice; others no longer can. Public image files are deleted; unhiding regenerates them.

## 8. Ask the AI Coach (MVP extension)

1. On their own draft or published photo, the user opens "Ask the Coach".
2. Chooses a focus (composition, light & exposure, technical quality, overall) and optionally asks a question; sees remaining allowance.
3. Analysis runs asynchronously; status is shown.
4. User sees private feedback: strengths, prioritised improvements, a next exercise, limitations; can rate or report it.
5. A failed analysis does not consume allowance.

## 9. Learning and challenges (MVP extension)

1. User opens Learning and a seeded path; reads a lesson; completion is saved.
2. Opens a challenge, uploads a photo as a **private submission** (separate from posts), reviews Shooting Details, submits.
3. Optionally requests challenge-context Coach feedback (same engine).
4. Reviews past submissions and feedback.

## 10. Admin manages places and equipment

1. Admin creates a draft place (name, category, description, practical notes, exact coordinates, public precision), previews, publishes; can edit or archive.
2. Admin verifies provisional equipment models and merges duplicates (merge and undo through admin endpoints; screen is an extension).
3. Admin requeues dead jobs when needed (CLI/endpoint).
