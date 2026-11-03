# ADR-007: Centralized Billing and Entitlements

- **Status:** Accepted (MVP scope narrowed 2026-11-03)
- **Decision:** Centralize entitlements and usage accounting in Billing, keyed by feature keys.
- **Context:** AI analysis needs consistent server-side limits; future premium features need the same mechanism.
- **MVP scope:** default limits per feature key from configuration plus per-user overrides set by admins; atomic usage counters. No plans, subscriptions or payment provider in the MVP (D-14).
- **Consequences:** Feature modules ask Billing for permission/limits and never inspect payment state. Plans and subscriptions can be added later without changing consumers.
