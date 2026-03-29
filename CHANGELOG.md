# Changelog

All notable changes to this project will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), using milestone headers instead of version numbers during pre-production development.

## [Unreleased] — Milestone 7: Data Portability (in progress)

### Added

- Email package (`packages/email`) — transactional email system with `EmailAdapter` interface, Resend adapter (hosted), SMTP adapter via Nodemailer (self-hosted), stub adapter (dev/testing), in-memory adapter (unit tests), and send parameter validation
- Email templates — 5 security notification templates: new device login, password changed, recovery key regenerated, two-factor changed, webhook failure digest
- Encrypted email storage — server-side encrypted email column on accounts table (ADR 029) with BLAKE2b hash for deterministic lookup preserved
- Email worker — `processEmailJob` BullMQ worker with email service registry, email-send job type and retry policy, recovery key regeneration email notification
- ADR 029: Server-side encrypted email storage — AES-256-GCM encryption for email addresses stored server-side
- ADR 030: Email provider selection — Resend for hosted, Nodemailer/SMTP for self-hosted, stub for dev
- Webhook enhancements — secret rotation endpoint, test/ping endpoint, optional payload encryption via API key, HMAC signature verification guide
- Webhook BullMQ handlers — job handlers for webhook delivery and cleanup (replacing queue-package handlers)
- Webhook event dispatch — wired `dispatchWebhookEvent` for 13 identity and friend events (member, fronting, group, lifecycle, custom-front, bucket, friend)

### Fixed

- M7 audit remediation (high priority) — anti-enumeration timing for auth endpoints, ownership consolidation, strict typing replacements for loose `Record<string, unknown>` types
- M7 audit remediation (medium + low) — webhook `as never` cast removal, email worker review findings, inconsistent zod imports, dependency updates

## Milestone 6: Privacy and Social

### Added

- Privacy buckets — intersection-based access control with fail-closed visibility, bucket content tagging for 21 entity types, field bucket visibility controls, CRDT sync strategy
- Friend network — friend code generation/redemption with invite codes (XXXX-XXXX format), friend connection lifecycle (accept, block, remove, archive), bucket assignment per friend, CRDT sync
- External dashboard — read-only friend dashboard endpoint filtered by bucket visibility, cross-account RLS helpers, bucket-scoped query helpers for all entity types
- Friend-side search — paginated friend data export with manifest endpoint, ETag/304 conditional caching, cursor-based keyset pagination across 21 entity types
- Push notifications — device token registration with ownership validation, notification config CRUD with per-friend preferences, push notification worker with switch alert delivery
- Report generation — bucket-scoped data export endpoint with manifest counts and key grants
- OpenAPI 3.1 specification expanded — 274 operations across 41 route domains (was 186 across 28)
- E2E tests expanded — 205 tests across 43 spec files (was 126 across 32)

### Fixed

- M6 audit remediation — 30 findings across security (device token takeover, member count leak, CRDT factory), performance (SQL-pushed bucket filtering, batch queries, caching), and code quality (shared helpers, barrel exports, constants extraction)

## Milestone 5: Communication

### Added

- Chat system — proxy-based messaging with channels, categories, and messages; polymorphic sender support (member, custom front, structure entity)
- Board messages — persistent noticeboard with drag-and-drop reorder, pin/unpin, polymorphic authorship
- Private notes — member-bound or system-wide notes with polymorphic authorship
- Polls — multiple-choice polls with cooperative voting, abstain/veto support, consensus analytics, polymorphic voters (member or structure entity)
- Mandatory acknowledgement routing — targeted alerts that persist until a specific member confirms, with resolution tracking
- Communication webhook events — webhook payloads for all communication entity lifecycle events
- CRDT sync strategies for channels, messages, board messages, notes, polls, votes, and acknowledgements
- Lifecycle events for all communication entities
- ADR 028: Opt-in IP address and user-agent audit logging
- E2E tests expanded — 126 tests across 32 spec files (was 79 across 24)

### Fixed

- M5 audit remediation — performance, type safety, correctness, code pattern, and simplification fixes across communication services
- Consolidated dependency updates and audit vulnerability fixes

### Changed

- IP address and user-agent audit logging is now opt-in per account (default off, ADR 028)
- Upgraded pnpm from 9.x to 10.x with `onlyBuiltDependencies` configuration
- **Structure entity refactor** — replaced 9 rigid structure tables (subsystems, side_systems, layers + 3 membership junctions + 3 cross-link junctions) with a generic 5-table entity model: user-defined entity types, entities, entity links, member links, and directed entity associations
- Extended `fronting_sessions` with `structure_entity_id` FK (replacing `linked_structure` jsonb) — structure entities can now be fronting subjects alongside members and custom fronts
- Extended `field_values` with `structure_entity_id` and `group_id` columns for polymorphic custom field ownership with mutual exclusivity CHECK
- Added `field_definition_scopes` table for targeting custom fields to specific entity types, groups, members, or system-wide
- Upgraded CRDT sync layer — structure entity link documents upgraded from junction-style to LWW-Map registers with parent-scoped sort normalization

## Milestone 4: Fronting Engine

### Added

- Fronting session CRUD — start/end sessions, co-fronting as parallel timelines, structure entity fronting, retroactive edits, outtrigger sentiment, active fronting query
- Fronting comments — unlimited-length per-session comments with polymorphic authorship (member, custom front, or structure entity)
- Fronting analytics — per-subject duration/percentage breakdowns, date range presets (7/30/90 days, year, all-time, custom), co-fronting pair analytics
- Fronting reports — stored analytics report snapshots with encrypted data
- Timer configs — recurring check-in timer CRUD with interval, waking hours window, archive/restore
- Check-in records — scheduled instances with respond/dismiss lifecycle, idempotency keys for duplicate prevention
- Timer scheduling worker — background job for generating check-in records on schedule
- Webhook config CRUD — endpoint registration with HMAC secret generation, event type filtering, archive/restore
- Webhook delivery CRUD — delivery attempt read/delete with status tracking (pending/success/failed/retrying)
- Webhook event dispatcher — creates pending deliveries for matching webhook configurations
- Webhook delivery worker — HMAC-signed payloads with exponential backoff retry
- Webhook delivery cleanup job — auto-purge terminal delivery records after 30 days
- ADR 027: Webhook secret rotation procedure
- CRDT sync strategies for fronting sessions, timers, webhooks, analytics, and lifecycle events
- Lifecycle event archive/restore/delete — CRDT strategy upgraded from append-only to append-lww
- E2E tests expanded — 79 tests across 24 spec files (was 51 across 14)

### Fixed

- Branded types across packages: `RecoveryKeyDisplay`, `KeyVersion`, `DisplayKey`, `Sha256Hex`, protocol IDs
- Replaced `as UnixMillis` casts with type-safe helper function
- Defined concrete payload types for all 15 `JobPayloadMap` entries
- N+1 query pattern audit and fixes across API routes
- Pagination cursor TTL expiry enforcement
- Retry jitter (0.2 fraction) added to default retry policies
- Device transfer code increased to 10+ digits (ADR 024)
- Removed deprecated `switches` table and types
- Structured logging module abstraction (replaced console methods)
- LRU eviction added to `BucketKeyCache`
- Typed errors applied to sync engine

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
- System structure data model — generic structure entity types, entities, entity links, member links, entity associations, relationships with generic CRUD extraction
- Media upload pipeline — presigned upload/download URLs, blob confirmation, lifecycle management, orphan cleanup (ADR 009)
- Per-category rate limit middleware — read/write/auth/sensitive categories with Valkey-backed distributed store
- Key rotation API endpoints — initiate, claim, complete-chunk, progress tracking (ADR 014)
- Innerworld CRUD — regions, entities, canvas with archive/restore/delete
- Lifecycle events — type-specific validation (ADR 026), cursor-based pagination
- Audit log — query endpoint with resourceType filtering, PII cleanup scheduling
- OpenAPI 3.1 specification — 155 operations across 20 route domains with client-side plaintext schemas for E2E encryption

### Fixed

- API comprehensive audit remediation — 36-issue audit across security, ownership, testing, and code quality; executed via 7 parallel worktree PRs

## Milestones 0-1: Foundation and Data Layer

### Added

- Core values (`VALUES.md`)
- AGPL-3.0 license
- Community files: Code of Conduct, Contributing guide, Security policy
- PR template with review checklist
- `.gitignore`, `.editorconfig`
- Architecture Decision Records (ADRs 001-023):
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
  - ADR 023: Zod-type alignment — strategy for keeping Zod schemas synchronized with TypeScript types
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
