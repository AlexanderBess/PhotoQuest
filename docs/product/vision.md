# Product Vision

## One-sentence vision

PhotoQuest helps photographers discover inspiring places, understand how photographs were made, share their work, and improve their skills — whether they are beginners, enthusiasts, or experienced photographers.

## The problem

Photography knowledge and inspiration are scattered across social networks, maps, camera forums, tutorials, and creator pages. A photographer looking for a place to shoot may find a location but not useful example photographs or practical advice. Someone who admires a photograph often cannot easily find the camera, lens, exposure settings, shooting conditions, or location behind it. People who want to improve their skills also lack a clear path from inspiration to deliberate practice.

## The solution

PhotoQuest connects photography, places, technical knowledge, and learning in one product. Users can:
- Discover photo locations and see what other photographers have captured there.
- Explore photographs with their Shooting Details: camera, lens, focal length, aperture, shutter speed, ISO, post-processing software and — when the author chooses to share it — location.
- Share their own work and equipment details, build a photography profile, and learn from other creators.
- Save places and photographs for future shoots.
- Ask the AI Photo Coach about their own photographs, and follow learning paths and practical challenges when they want to develop specific skills.

The product must be useful to someone who never takes a course or uses the AI Coach. Discovery is the primary value; learning is a supporting pillar (ADR-018).

## Target audience

PhotoQuest serves three overlapping segments:

### Learners
- Beginners and developing photographers who want structured guidance.
- Need clear exercises, explanations, feedback, and visible progress.

### Photography enthusiasts (initial priority)
- People who actively take photographs and seek inspiration, new locations, and ideas.
- Want to browse real photographs, understand how they were made, and plan their own shoots.

### Experienced photographers
- Confident hobbyists and advanced creators who want to scout locations, share work with meaningful technical context, and exchange knowledge.
- May use PhotoQuest primarily as a discovery and reference tool.

It is not a professional studio CRM or a general-purpose image editor.

## Core product pillars

### 1. Explore — places and shoot inspiration
Discover photography locations through a map and a catalog. In the MVP locations are curated by editors; community-contributed locations are a later step. Location pages show example photographs and practical notes. Precise locations of authors' photos remain under the author's control.

### 2. Discover — photographs and Shooting Details
Browse photographs and learn how they were made: camera and lens, focal length, aperture, shutter speed, ISO, exposure compensation, flash, capture date/time, post-processing software, and a location shown at the precision the author chose.

### 3. Share — photographer profiles
Publish photographs, maintain a profile and gear list, and be credited for your work. PhotoQuest encourages useful context rather than optimising for likes or follower counts. Rich social interaction (comments, follows, groups) is future scope.

### 4. Learn — structured skill development (supporting)
Learning paths, lessons, practical challenges, and progress history for users who want deliberate improvement. Not a prerequisite for any discovery feature.

### 5. AI Photo Coach — optional personalised guidance (supporting)
Constructive, prioritised, private suggestions on one of the user's own photographs — independent of learning paths, with challenge context added later. The AI explains its reasoning and limitations, avoids presenting subjective judgements as objective scores, and never replaces human judgement.

## Core user journeys

### Find a place to shoot
1. Search or browse locations on the map or in the list (no account needed).
2. Open a location and review example photographs and practical notes.
3. Inspect Shooting Details of photographs there.
4. Sign in and save the location for a future shoot.
5. Upload a photograph from the visit and link it to the location.

### Learn from a photograph
1. Discover a photograph in the feed or on a location page.
2. Open its Shooting Details.
3. Explore camera, lens, exposure settings, and the author's context.
4. Save the photograph as inspiration or try a similar technique.

### Publish a photograph
1. Upload a photograph.
2. Review and correct the extracted Shooting Details.
3. Optionally add a location and choose its mode: exact, approximate, or private. The mode limits everything others can see about where the photo was taken.
4. Publish; the photo appears in the feed, on the author's profile and, in exact mode, on the location page.

### Improve a photograph (supporting)
1. Open one of your own photos and ask the AI Coach, choosing a focus.
2. Read private feedback and a suggested next exercise.

### Develop a skill (supporting)
1. Choose a learning path or challenge.
2. Read the objective and practical task.
3. Take and submit a photograph.
4. Receive AI Coach feedback in the context of the challenge where available.
5. Track completed practice.

## Product principles

- Useful across experience levels: no journey is mandatory.
- Real photographs and practical context over generic inspiration content.
- Respect attribution and user control over image and location privacy.
- Technical metadata is understandable, correctable, and clearly marked when unavailable.
- AI is an assistant, not an authority.
- Build repeat usage around discovery, reference, contribution, and learning — not vanity metrics.
- Start with a focused local launch (Novosibirsk, Russian UI), then expand when the core experience is validated.

## Positioning

PhotoQuest is a photography discovery and knowledge platform with learning tools. It is not only a course platform, a generic social network, a map directory, or an AI filter app. Its distinctive value comes from connecting real photographs, places, Shooting Details, and practical skill development.

## North Star Metric

**Weekly Meaningful Photography Actions:** unique users per week who complete at least one high-value action — saving a location or photo, expanding Shooting Details, publishing a photograph, or completing a learning challenge. Each action is tracked separately so growth in casual browsing does not hide weak contribution or learning.

Supporting metrics:
- Search-to-location-view and location-save conversion.
- Photo views that expand Shooting Details.
- Saved photographs and locations per active user.
- First photo published and repeat publishing.
- Content supply: photos published per contributor per week; share of published locations with at least three photos.
- Percentage of posts with usable Shooting Details.
- Learning challenge starts and completions.
- AI Coach usage and helpfulness rating.
- Weekly/monthly retention by audience segment.
- Later: free-to-paid conversion, churn, variable cost per active user.

## Business model hypotheses

- Free discovery, profiles, and publishing to build useful content.
- Pro subscription for advanced discovery filters, collections/planning tools, and a higher AI Coach allowance.
- Paid learning programs, workshops, and photo walks.
- Later partnerships with photography schools, clubs, instructors, local venues, and tourism partners.

Pricing and willingness to pay are hypotheses to validate. Payments are not part of the MVP.
