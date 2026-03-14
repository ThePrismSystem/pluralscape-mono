# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Core values (`VALUES.md`)
- AGPL-3.0 license
- Community files: Code of Conduct, Contributing guide, Security policy
- PR template with review checklist
- `.gitignore`, `.editorconfig`
- Architecture Decision Records (22 total):
  - ADR 001: AGPL-3.0 license
  - ADR 002: Frontend framework (Expo / React Native)
  - ADR 003: API framework (Hono + tRPC + REST on Bun)
  - ADR 004: Database (PostgreSQL + Drizzle ORM / SQLite)
  - ADR 005: Offline-first sync (custom CRDT with Automerge)
  - ADR 006: Encryption (libsodium, Etebase-inspired protocol)
  - ADR 007: Real-time (WebSockets + SSE + Valkey)
  - ADR 008: Runtime (Bun with Node.js fallback)
  - ADR 009: Blob/media storage (S3-compatible, MinIO for self-hosted)
  - ADR 010: Background job architecture (BullMQ / SQLite fallback)
  - ADR 011: Key lifecycle and recovery (recovery key, multi-device transfer)
  - ADR 012: Self-hosted deployment tiers (minimal vs full)
  - ADR 013: API authentication with E2E encryption (hybrid model)
  - ADR 014: Lazy key rotation for privacy buckets
  - ADR 015: Plaintext push tokens (server-side only)
  - ADR 016: Hash-based message table partitioning
  - ADR 017: Time-based audit log partitioning
  - ADR 018: Encryption-at-rest DB layer boundary
  - ADR 019: Fronting sessions time-based partitioning
  - ADR 020: RLS denormalization (cached system_id/account_id)
  - ADR 021: Non-system account model (viewer accounts)
  - ADR 022: System structure snapshots
- Encryption architecture research (`docs/planning/encryption-research.md`)
- Audits:
  - License compatibility audit (`docs/audits/001-license-compatibility.md`)
  - Hosting cost estimate (`docs/audits/002-hosting-cost-estimate.md`)
  - Database schema audit (`docs/audits/003-database-schema-audit.md`)
- `@pluralscape/types` package — 30+ domain type modules with Zod validators, branded IDs, and runtime helpers covering identity, fronting, communication, privacy, encryption tiers, sync, jobs, webhooks, search, i18n, and more
- `@pluralscape/db` package — Drizzle ORM schema for PostgreSQL and SQLite dual-dialect with 40+ tables, row-level security, common views, query helpers, and encryption contract hardening
- `@pluralscape/crypto` package — libsodium cross-platform bindings (WASM + React Native), master key derivation, symmetric encryption/decryption, identity keypair generation, and signature operations
- `@pluralscape/sync` package — encrypted CRDT relay proof-of-concept with Automerge, sync session management, and document topology design
- Test framework — Vitest workspace configuration with coverage enforcement, test factories, and shared utilities (2,889 tests across 144 files)
- Database schema hardening — 29 optimization tasks: performance indexes (composites, partials, covering), non-critical encryption (API keys, sessions, webhooks, wiki slugs), sync queue fixes, full-text search, and varchar right-sizing
- RLS policy bootstrapping — row-level security policies for all tenant-scoped tables with session-based isolation
- SQLCipher encryption-at-rest — encrypted SQLite for self-hosted deployments
- Launch feature types and schema (L2-L10) — non-system accounts, fronting snapshots, member duplication, outtrigger, multi-system verification, system duplication, lifecycle events (structure-move, innerworld-move), system snapshots
- Entity archival support — archived/archived_at columns across all non-audit entity types with consistency checks and partial indexes
- Entity archival FK audit (`docs/audits/011-entity-archival-fk-audit.md`) — complete FK dependency map for 26+ archivable entities
- 12 future feature specifications (`docs/future-features/`) — widgets, cosmetics, client SDKs, onboarding, linked fronting, outtrigger analytics, traumaversary tracking, therapist reports, journal custom fields, journal fronting context, member templates, custom lifecycle events
- Blob metadata, notification, and webhook integration tests (PG + SQLite)
- Work tracking with beans (CLI-based issue tracker committed alongside code)
- Roadmap generation from beans (`pnpm roadmap`)
- CodeQL security analysis integration (`pnpm codeql`)

### Fixed

- Security: overridden flatted to >=3.4.0 to resolve DoS vulnerability
- Schema audit 005 critical and high findings (C3, H1, H2)
- Schema audit 008 findings across schema, queries, and RLS
- Composite FK constraints and view join correctness
