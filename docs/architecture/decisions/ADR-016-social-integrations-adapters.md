# ADR-016: Future Social Integrations via Provider Adapters

- **Status:** Accepted
- **Decision:** Implement future social account connections in a separate Social Integrations module using provider adapters.
- **Context:** Instagram capabilities and permissions differ by account type and platform policy; other providers may be added later.
- **Consequences:** Do not couple core identity or profile behavior to Instagram OAuth. Verify current provider requirements before implementation.
