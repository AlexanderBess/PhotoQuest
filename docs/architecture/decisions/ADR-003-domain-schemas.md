# ADR-003: Logical Domain Schemas

- **Status:** Accepted
- **Decision:** Use one PostgreSQL database with logical schemas per domain.
- **Context:** Logical separation improves ownership and discoverability without distributed database operations.
- **Consequences:** Cross-schema references are allowed where appropriate, but module code must still respect domain boundaries.
