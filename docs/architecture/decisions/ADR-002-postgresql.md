# ADR-002: PostgreSQL as Primary Database

- **Status:** Accepted
- **Decision:** Use PostgreSQL as the primary relational database.
- **Context:** The product has relational learning, identity, submission, billing, and media metadata.
- **Consequences:** Use transactions, constraints, and indexes. Avoid premature database sharding or multiple databases.
