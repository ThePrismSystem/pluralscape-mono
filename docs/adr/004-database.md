# ADR 004: Database — PostgreSQL + Drizzle ORM (SQLite for Self-Hosted)

## Status

Accepted

## Context

The database must support:

- Complex relational data (systems, members, groups, fronting logs, chat channels, privacy buckets)
- Encryption at rest (server-side defense-in-depth on top of E2E encryption)
- Self-hosting with minimal configuration
- Security auditability — generated queries must be inspectable
- Scale to 500K users on the hosted service
- Offline-first client-side storage (SQLite on devices)

Evaluated: PostgreSQL, CockroachDB, SurrealDB, SQLite. Evaluated Drizzle ORM vs Prisma.

## Decision

**PostgreSQL** with **Drizzle ORM** for the hosted service. **SQLite** as an alternative for self-hosted deployments. Drizzle abstracts the dialect, allowing the same schema to target both.

Key factors:

- **PostgreSQL**: Battle-tested at any scale, true open source. Row-level security for multi-tenant isolation. pgcrypto for column-level encryption at rest. JSONB for flexible schema needs (custom fields, system metadata). Logical replication supports sync engines.
- **Drizzle ORM**: Code-first TypeScript schema (no separate schema language). SQL-like query builder gives full visibility into generated queries — critical for security auditing. Smaller bundle size than Prisma (important for self-hosted/single-binary). Supports both PostgreSQL and SQLite dialects.
- **SQLite for self-hosting**: Zero-config, single-file database. Eliminates the need for a separate database container. Combined with Bun's single binary, self-hosters deploy one file.

Rejected alternatives:

- **CockroachDB**: No longer open source (proprietary license since November 2024, mandatory telemetry). Overkill for single-node self-hosting.
- **SurrealDB**: Still immature despite 3.0 GA claim. Performance regressions documented. Project direction pivoting toward AI agent memory.
- **Prisma**: Prisma 7 narrowed the performance gap, but Drizzle's SQL transparency is more valuable for a security-sensitive app.

## Consequences

- Two database targets increases testing surface — CI must test against both PostgreSQL and SQLite
- Some PostgreSQL-specific features (RLS, JSONB operators, pgcrypto) won't be available on SQLite — feature detection or conditional code paths needed
- Drizzle's dialect-agnostic query builder mitigates most cross-database issues but edge cases will exist
- Schema migrations must be validated against both targets

### License

PostgreSQL: PostgreSQL License (BSD-like permissive). Drizzle ORM: Apache 2.0. SQLite: Public Domain. All compatible with AGPL-3.0.
