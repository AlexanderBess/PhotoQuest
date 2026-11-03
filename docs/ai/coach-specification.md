# AI Photo Coach Specification

## Purpose and scope

The AI Coach helps photographers understand and improve **their own photographs** (ADR-008). It gives practical, private guidance; it does not judge objective artistic quality.

- **Tier:** MVP extension, behind a server-side feature flag. It must not delay the pilot.
- **MVP entry point:** the user's own **draft or published post** ("Ask the Coach"). No dependency on Learning or Challenges.
- **Later entry point:** challenge submissions, using the same engine with challenge context.
- **Not in MVP:** analysis of other users' photos; sharing feedback.

## Subject and context

- **Subject:** `subject_type` (`post`; later `submission`) + `subject_id` + the subject's Media Asset. The owning module (Community, later Learning) authorises the request — the viewer must own the subject — and passes the asset to Coach. Coach never accepts a client-supplied asset ID on its own authority.
- **Context:**
  - `general` (MVP): focus — composition, light & exposure, technical quality, or overall — plus an optional question/intent. Uses **general focus rubrics owned by Coach**, versioned with the prompt.
  - `challenge` (later): challenge objective and rubric supplied by Content/Learning through an optional interface. Dependency direction: Learning/Content → Coach.

## Inputs sent to the provider

- The `ai_analysis` variant (resized, metadata-free).
- Focus, optional question, rubric (general or challenge).
- Optional Shooting Details (camera, lens, focal length, aperture, shutter speed, ISO).
- User experience level.

Never send location data (place, point, area, label), GPS, raw EXIF, email or other profile data.

## Output contract

Structured JSON validated against a server-owned schema:

```json
{
  "summary": "A concise overall observation.",
  "strengths": [{ "title": "Clear subject separation", "explanation": "The subject stands out from the background." }],
  "improvements": [{ "priority": 1, "title": "Try a lower camera angle", "explanation": "…", "action": "Take another frame from approximately knee height." }],
  "next_exercise": { "title": "Change your point of view", "instructions": "Make three frames of the same subject from different heights." },
  "limitations": ["The image alone may not reveal the photographer's intent."]
}
```

Formalised in code/OpenAPI. Feedback is generated in the user's UI language (Russian in the pilot).

## Feedback principles and guardrails

- Specific, referring to visible aspects of the photo; connected to the chosen focus (or challenge objective).
- 2–3 prioritised improvements and an actionable next step.
- No scores; no single "correct" artistic choice; acknowledge uncertainty about intent.
- Critique photographic choices only: never comment on people's appearance and never infer sensitive attributes.
- No unsupported claims about settings or scene conditions.

## Privacy

- Feedback is visible only to the photo's owner; admins see it only when handling a report about it (audit-logged).
- Not shown on public pages, feeds or in analytics payloads.
- Deleting the subject deletes its feedback; usage counters keep only counts.

## Pipeline

1. Owner requests analysis; the owning module authorises; Coach asks Billing to reserve allowance (`ai.coach.analyses_per_month`) and checks a per-subject cooldown (same `input_fingerprint`).
2. An analysis record is created and a `coach.analyze` job inserted in the same transaction (ADR-022).
3. Worker loads the `ai_analysis` variant, calls the provider adapter with a timeout and bounded retries.
4. Response is schema-validated and stored; allowance consumed once (keyed by analysis ID).
5. Final failure: safe error code, reservation released, retry state shown.

## Provider abstraction

```go
type PhotoAnalysisProvider interface {
    Analyze(ctx context.Context, input AnalysisInput) (AnalysisResult, error)
}
```

Provider SDKs stay inside adapters. Provider choice is D-02 (regional availability, cost, data terms; see R-07).

## Observability and cost control

Record provider, model, prompt version, rubric version, status, latency, token usage, estimated cost, retries and error category. Allowance enforced server-side.

## Human feedback

Users can rate usefulness and report feedback (`target_type = ai_feedback`). Use this to improve prompts and rubrics, not to claim model quality without evaluation.
