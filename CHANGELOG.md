# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Upgraded pnpm from 9.x to 10.x with `onlyBuiltDependencies` configuration

## Milestone 3: Sync and Real-Time

### Added

- Encrypted CRDT sync (`packages/sync`) — Automerge relay with encrypted sync payloads, sync session management, document topology, subscription profiles
- WebSocket sync server — binary protocol, bounded subscriptions, auth timeout, graceful shutdown
- SSE notification stream — heartbeat, reconnect replay, per-account fan-out, idle timeout handling
- Offline queue and replay — batched drain, causal ordering, exponential backoff, cryptographic confirmation before clearing local data
- Conflict resolution engine — post-merge validation, hierarchy cycle detection, sort-order repair
- Multi-device key transfer — device transfer protocol, code entropy (ADR 024), attempt limiting, transfer session cleanup job
- Valkey pub/sub adapter — cross-instance fan-out, auto-resubscribe on reconnect
- E2E test suite (`apps/api-e2e`) — Playwright, 51 tests covering auth, sync, SSE, device transfer, members
- ADR 024: Device transfer code entropy
- ADR 025: Webhook secret storage (T3 plaintext)
- ADR 026: Lifecycle event type-specific validation

### Fixed

- M2 audit scorecard remediation — timing side-channels, structured logging, response envelope standardization, DRY violations
- M3 comprehensive audit remediation — 42 HIGH+MEDIUM findings across 12 parallel worktree PRs
- M3 low-severity audit remediation — 28 findings across security, performance, and code quality
- SSE idle timeout handling for signed envelopes in E2E tests
- Client-factory PG pool mock test stabilization

## Milestone 2: API Core

### Added

- Auth system — registration, login, session management, recovery key backup/regeneration, password reset via recovery key, biometric token enrollment, session token hashing (ADR 013, ADR 021)
- Member CRUD — full lifecycle (create, read, update, archive, restore, duplicate, permanent delete), member photos, custom field values, member-centric membership queries
- Groups and folders — CRUD, hierarchical nesting, membership management, group copy, cycle detection
- Custom fronts — CRUD with archive/restore
- System settings — CRUD with encrypted data and PIN verification
- Initial setup wizard — multi-step onboarding (profile, nomenclature, completion)
- System structure data model — subsystems, side-systems, layers, relationships, structure links, structure memberships with generic CRUD extraction
- Media upload pipeline — presigned upload/download URLs, blob confirmation, lifecycle management, orphan cleanup (ADR 009)
- Per-category rate limit middleware — read/write/auth/sensitive categories with Valkey-backed distributed store
- Key rotation API endpoints — initiate, claim, complete-chunk, progress tracking (ADR 014)
- Innerworld CRUD — regions, entities, canvas with archive/restore/delete
- Lifecycle events — type-specific validation (ADR 026), cursor-based pagination
- Audit log — query endpoint with resourceType filtering, PII cleanup scheduling
- OpenAPI 3.1 specification — 155 operations across 20 route domains with client-side plaintext schemas for E2E encryption
- ADR 023: Zod-type alignment

### Fixed

- API comprehensive audit remediation — 36-issue audit across security, ownership, testing, and code quality; executed via 7 parallel worktree PRs

## Milestones 0-1: Foundation and Data Layer

### Added

- Core values (`VALUES.md`)
- AGPL-3.0 license
- Community files: Code of Conduct, Contributing guide, Security policy
- PR template with review checklist
- `.gitignore`, `.editorconfig`
- Architecture Decision Records (ADRs 001-022):
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
- `@pluralscape/types` package — 30+ domain type modules with Zod validators, branded IDs, runtime helpers, API operational constants (rate limits, pagination, session timeouts, error codes), and `ServerSafe<T>` compile-time enforcement
- `@pluralscape/db` package — Drizzle ORM schema for PostgreSQL and SQLite dual-dialect with 40+ tables, row-level security, common views, query helpers, and encryption contract hardening
- `@pluralscape/crypto` package — libsodium cross-platform bindings (WASM + React Native), master key derivation, symmetric encryption/decryption, identity keypair generation, signature operations, bucket key management, and client-side blob encryption pipeline
- `@pluralscape/sync` package — encrypted CRDT relay proof-of-concept with Automerge, sync session management, and document topology design
- `@pluralscape/storage` package — S3-compatible blob storage adapter, filesystem adapter for self-hosted deployments, quota management with orphan detection, and lifecycle cleanup jobs
- `@pluralscape/queue` package — SQLite-backed background job queue with retry policies (exponential/linear backoff), dead letter queue (DLQ), job observability (metrics, health checks, alerts), and stalled job sweeper
- `@pluralscape/i18n` package — internationalization framework with locale-aware date/number/duration/relative-time formatting, nomenclature term resolution for community terminology, and React provider integration
- `@pluralscape/validation` package — shared Zod validation schemas with branded type predicates (NaN/Infinity rejection) and contract tests ensuring type-schema alignment
- API foundation (`apps/api`) — Hono server on Bun with CORS configuration, security headers (HSTS, CSP, etc.), in-memory rate limiting middleware, structured error handling with `ApiErrorResponse` format, and middleware composition tests
- API specification (`docs/planning/api-specification.md`) — concrete operational constants for rate limits (12 categories), pagination (cursor + offset), session timeouts, retry policies, error codes, friend code tiers, audit retention, and blob size limits
- Test framework — Vitest workspace configuration with coverage enforcement, test factories, and shared utilities
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
- Rate limiter hardening: TRUST_PROXY support, eviction, fixed-window semantics
- CORS: cache config at startup, filter empty origins, gate HSTS on HTTPS
- Storage: branded type enforcement in filesystem and S3 adapters
- Crypto: minimum password length enforcement in key derivation
- Crypto: blob encryption pipeline hardened per PR review
- Validation: reject NaN and Infinity in branded number predicates
- API specification: correct HTTP status code labels, windowMs alignment with middleware
