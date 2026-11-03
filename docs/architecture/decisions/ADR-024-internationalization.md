# ADR-024: Internationalization — Russian First, English-Ready

- **Status:** Accepted (product owner decision, 2026-11-03; library confirmed 2026-11-03)
- **Decision:**
  - The pilot UI ships in Russian only (`ru`, default and fallback).
  - The frontend is i18n-ready from PQ-002: all user-facing strings in locale message files, Russian plural rules, `Intl`-based date/number formatting, localised Shooting Details unit labels, API errors mapped from stable codes.
  - Library: Vue I18n (Composition API mode); locale messages precompiled at build time for strict-CSP compatibility.
  - Adding English or another language requires a new locale folder registered with the shared language switcher, not component changes.
  - Editorial content (locations, learning content) is Russian-only in the MVP; content translation is future scope.
  - AI Coach feedback is generated in the user's UI language.
- **Context:** The pilot audience is in Novosibirsk; later expansion may need English.
- **Consequences:** Slight upfront cost in PQ-002; a missing-key/raw-string check in CI where practical.
