# ADR-001: Modular Monolith

- **Status:** Accepted
- **Decision:** Build one backend application with explicit domain modules.
- **Context:** The MVP is built by a small team/founder. Distributed services would add operational complexity before scale or team boundaries justify it.
- **Consequences:** Modules need strict boundaries and public interfaces. Independent deployment is not available initially, but extraction remains possible if a future need is demonstrated.
