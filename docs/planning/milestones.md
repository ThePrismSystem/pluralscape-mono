# Development Milestones

Target: full feature parity with Simply Plural plus new features.

Milestones are ordered by dependency, not as a waterfall schedule. In practice, development proceeds vertically — one feature end-to-end (types, schema, API, UI, tests) rather than completing entire horizontal layers before moving on.

## Milestone 0: Foundation [COMPLETED]

Goal: Monorepo infrastructure, tooling, governance

- Monorepo scaffolding (pnpm, turbo, shared tooling)
- Architecture decisions (ADRs 001-008)
- CI/CD pipeline (lint, typecheck)
- Public repo setup (branch protection, issue templates, dependabot)
- License audit

## Milestone 1: Data Layer [COMPLETED]

Goal: Domain types, database schema, encryption primitives, sync protocol design, i18n foundation, API specification

Epics:

- ~~Domain types (`packages/types`)~~ [COMPLETED] — 30+ domain type modules with Zod validators and branded IDs
- ~~Database schema (`packages/db`)~~ [COMPLETED] — 40+ tables, dual-dialect (PG + SQLite), RLS, constraint closure, encryption contracts
- ~~Database schema hardening~~ [COMPLETED] — 29 tasks: indexes, encryption, sync queue fixes, full-text search, varchar right-sizing
- ~~Test framework setup~~ [COMPLETED] — Vitest workspace, coverage enforcement, test factories
- ~~Launch feature types (L2-L10)~~ [COMPLETED] — non-system accounts, fronting snapshots, member duplication, outtrigger, multi-system verification, system duplication, lifecycle events, innerworld-move, system snapshots
- ~~Entity archival~~ [COMPLETED] — archived/archived_at columns across all non-audit entity types with consistency checks and partial indexes
- ~~RLS policy bootstrapping~~ [COMPLETED] — row-level security policies for all tenant-scoped tables
- ~~SQLCipher encryption-at-rest~~ [COMPLETED] — encrypted SQLite for self-hosted deployments
- ~~Database schema documentation~~ [COMPLETED] — full ER diagrams for all 40+ tables
- ~~Encryption layer (`packages/crypto`)~~ [COMPLETED] — ADR 006: key derivation, symmetric crypto, identity keypairs, bucket key management, blob encryption pipeline, key rotation API types
- ~~Sync protocol design (`packages/sync`)~~ [COMPLETED] — ADR 005: encrypted CRDT relay, document topology, sync session management, subscription profiles
- ~~Blob storage (`packages/storage`)~~ [COMPLETED] — ADR 009: S3-compatible adapter, filesystem adapter, quota management, lifecycle cleanup
- ~~Background job infrastructure (`packages/queue`)~~ [COMPLETED] — ADR 010: SQLite-backed job queue, retry policies, DLQ, observability
- ~~Key recovery protocol~~ [COMPLETED] — ADR 011: recovery key types, device transfer protocol
- ~~i18n infrastructure (`packages/i18n`)~~ [COMPLETED] — locale formatting, nomenclature term resolution, React provider
- ~~Nomenclature system~~ [COMPLETED] — community terminology system with configurable presets
- ~~Validation (`packages/validation`)~~ [COMPLETED] — shared Zod schemas with branded type predicates and contract tests (ADR 023)
- ~~API specification~~ [COMPLETED] — concrete operational constants for rate limits, pagination, sessions, errors, and retry policies
- ~~API foundation (`apps/api`)~~ [COMPLETED] — Hono server with CORS, security headers, rate limiting, error handling middleware

## Milestone 2: API Core [COMPLETED]

Goal: Authentication, identity management, core CRUD

Epics:

- ~~Auth system~~ [COMPLETED] — registration, login, session management, recovery key backup/regeneration, password reset via recovery key, biometric token enrollment, session token hashing (ADR 013, ADR 021)
- ~~Member CRUD~~ [COMPLETED] — full lifecycle (create, read, update, archive, restore, duplicate, permanent delete), member photos, custom field values, member-centric membership queries (L4)
- ~~Groups and folders~~ [COMPLETED] — CRUD, hierarchical nesting, membership management, group copy, cycle detection
- ~~Custom fronts~~ [COMPLETED] — CRUD with archive/restore
- ~~System settings~~ [COMPLETED] — CRUD with encrypted data and PIN verification
- ~~Initial setup wizard~~ [COMPLETED] — multi-step onboarding (profile, nomenclature, completion)
- ~~System structure data model~~ [COMPLETED] — generic structure entity types, entities, entity links, member links, entity associations, relationships with generic CRUD extraction
- ~~Media upload pipeline~~ [COMPLETED] — presigned upload/download URLs, blob confirmation, lifecycle management, orphan cleanup (ADR 009)
- ~~Per-category rate limit middleware wiring~~ [COMPLETED] — read/write/auth/sensitive categories with Valkey-backed distributed store
- ~~Key rotation API endpoints~~ [COMPLETED] — initiate, claim, complete-chunk, progress tracking (ADR 014)
- ~~Innerworld CRUD~~ [COMPLETED] — regions, entities, canvas with archive/restore/delete
- ~~Lifecycle events~~ [COMPLETED] — type-specific validation, cursor-based pagination (ADR 026)
- ~~Audit log~~ [COMPLETED] — query endpoint with resourceType filtering, PII cleanup scheduling
- ~~API comprehensive audit remediation~~ [COMPLETED] — 36-issue audit across security, ownership, testing, and code quality; executed via 7 parallel worktree PRs
- ~~OpenAPI 3.1 specification~~ [COMPLETED] — 155 operations across 20 route domains with client-side plaintext schemas for E2E encryption

## Milestone 3: Sync and Real-Time [COMPLETED]

Goal: Sync implementation, WebSocket transport, offline resilience

Epics:

- ~~CRDT sync implementation~~ [COMPLETED] — Automerge relay with encrypted sync payloads, sync session management, document topology, subscription profiles (`packages/sync`)
- ~~WebSocket sync server~~ [COMPLETED] — binary protocol, bounded subscriptions, auth timeout, graceful shutdown, Valkey pub/sub for cross-instance fan-out
- ~~SSE notification stream~~ [COMPLETED] — heartbeat, reconnect replay, per-account fan-out, idle timeout handling
- ~~Offline queue and replay~~ [COMPLETED] — batched drain, causal ordering, exponential backoff, cryptographic confirmation before clearing local data
- ~~Conflict resolution~~ [COMPLETED] — post-merge validation engine, hierarchy cycle detection, sort-order repair
- ~~Multi-device key transfer~~ [COMPLETED] — device transfer protocol, code entropy (ADR 024), attempt limiting, transfer session cleanup job
- ~~Valkey pub/sub adapter~~ [COMPLETED] — cross-instance fan-out, auto-resubscribe on reconnect
- ~~E2E test suite~~ [COMPLETED] — Playwright (`apps/api-e2e`), 51 tests covering auth, sync, SSE, device transfer, members
- ~~M2 audit scorecard remediation~~ [COMPLETED] — timing side-channels, structured logging, response envelope standardization, DRY violations
- ~~M3 comprehensive audit remediation~~ [COMPLETED] — 42 HIGH+MEDIUM findings across 12 parallel worktree PRs, plus 28 LOW-severity findings

## Milestone 4: Fronting Engine [COMPLETED]

Goal: Front logging, co-fronting, analytics, timers, webhooks

Epics:

- ~~Front logging API~~ [COMPLETED] — fronting session CRUD (start/end, co-fronting as parallel timelines, structure entity fronting, retroactive edits, outtrigger sentiment), fronting comments, active fronting query, CRDT sync strategies (`packages/sync`)
- ~~Analytics engine~~ [COMPLETED] — per-subject fronting duration/percentage breakdowns, date range presets, co-fronting pair analytics, fronting report snapshots, CRDT sync
- ~~Automated timers and check-in reminders~~ [COMPLETED] — timer config CRUD with waking hours window, check-in record CRUD with respond/dismiss lifecycle, timer scheduling worker, CRDT sync
- ~~Webhooks event system~~ [COMPLETED] — webhook config CRUD with HMAC secret generation, delivery CRUD with status tracking, event dispatcher, delivery worker with exponential backoff, delivery cleanup job (30-day retention), secret rotation (ADR 027), CRDT sync
- ~~Lifecycle event archive/delete~~ [COMPLETED] — archive/restore/delete endpoints, CRDT strategy upgraded from append-only to append-lww
- ~~Tech debt / hardening~~ [COMPLETED] — branded types (RecoveryKeyDisplay, KeyVersion, DisplayKey, Sha256Hex, protocol IDs), UnixMillis helper, JobPayloadMap concrete types, N+1 query fixes, cursor TTL enforcement, retry jitter, device transfer code entropy (ADR 024), switches table removal, structured logging, BucketKeyCache LRU eviction, sync engine typed errors (15 tasks, 1 scrapped)

## Milestone 5: Communication [COMPLETED]

Goal: Internal messaging, boards, notes, polls

Epics:

- ~~Chat system~~ [COMPLETED] — proxy-based messaging with channels/categories, polymorphic sender support (member, custom front, structure entity), CRDT sync, lifecycle events, E2E tests
- ~~Board messages~~ [COMPLETED] — persistent noticeboard with drag-and-drop reorder, pin/unpin, polymorphic authorship, CRDT sync, lifecycle events, E2E tests
- ~~Private notes~~ [COMPLETED] — member-bound or system-wide notes with polymorphic authorship, CRDT sync, lifecycle events, E2E tests
- ~~Polls~~ [COMPLETED] — multiple-choice polls with cooperative voting, abstain/veto support, consensus analytics, polymorphic voters (member or structure entity), CRDT sync, lifecycle events, E2E tests
- ~~Mandatory acknowledgement routing~~ [COMPLETED] — targeted alerts with member confirmation, resolution tracking, CRDT sync, lifecycle events, E2E tests
- ~~Communication webhooks~~ [COMPLETED] — webhook payloads for all communication entity lifecycle events, integration tests, E2E tests
- ~~M5 audit remediation~~ [COMPLETED] — performance, type safety, correctness, code pattern, and simplification fixes across communication services

## Milestone 6: Privacy and Social [COMPLETED]

Goal: Privacy engine, friend network, external access

Epics:

- ~~Privacy buckets~~ [COMPLETED] — intersection-based access control with fail-closed visibility, bucket content tagging for 21 entity types, field bucket visibility controls, Zod validation, CRDT sync strategy, E2E tests, OpenAPI spec
- ~~Friend network~~ [COMPLETED] — friend code generation/redemption (XXXX-XXXX format), friend connection lifecycle (accept, block, remove, archive), bucket assignment per friend, account ownership helpers, CRDT sync, E2E tests, OpenAPI spec
- ~~Push notifications~~ [COMPLETED] — device token registration with ownership validation and takeover prevention, notification config CRUD with per-friend preferences, push notification worker with switch alert delivery, CRDT sync, E2E tests, OpenAPI spec
- ~~External dashboard~~ [COMPLETED] — read-only friend dashboard endpoint filtered by bucket visibility, cross-account RLS helpers, bucket-scoped query helpers for all entity types, CRDT dashboard snapshot projection, E2E tests, OpenAPI spec
- ~~Friend-side search~~ [COMPLETED] — paginated friend data export with manifest endpoint, ETag/304 conditional caching, cursor-based keyset pagination across 21 entity types, data freshness headers, E2E tests, OpenAPI spec
- ~~Report generation~~ [COMPLETED] — bucket-scoped data export endpoint with manifest counts and key grants, E2E tests, OpenAPI spec
- ~~M6 audit remediation~~ [COMPLETED] — 30 findings across security (device token takeover, member count leak, CRDT factory), performance (SQL-pushed bucket filtering, batch queries, caching), and code quality (shared helpers, barrel exports, constants extraction); executed via 10 parallel worktree PRs

## Milestone 7: Data Portability [IN PROGRESS]

Goal: Email notifications, webhook enhancements, public API audit, integration guides

Epics:

- ~~Email notification system~~ [COMPLETED] — `packages/email` with Resend adapter (hosted), SMTP/Nodemailer adapter (self-hosted), stub adapter (dev/testing), in-memory adapter (unit tests); 5 security notification templates (new device login, password changed, recovery key regenerated, two-factor changed, webhook failure digest); email worker with BullMQ job handler; encrypted email storage on accounts (ADR 029, ADR 030)
- ~~Webhook enhancements~~ [COMPLETED] — secret rotation endpoint, test/ping endpoint, optional payload encryption via API key, HMAC signature verification guide, BullMQ job handlers for delivery and cleanup
- ~~Webhook event dispatch~~ [COMPLETED] — wired `dispatchWebhookEvent` for 13 identity and friend events (member, fronting, group, lifecycle, custom-front, bucket, field-bucket-visibility, friend)
- ~~M7 audit remediation~~ [COMPLETED] — high-priority (anti-enumeration timing, ownership consolidation, strict typing), medium+low (webhook cast removal, email worker fixes, zod imports, dependency updates)
- ~~API feature completeness~~ [COMPLETED] — closed audit gaps across the REST API surface: account deletion/PIN/device transfer approval, friend accept/reject/dashboard sync, API key CRUD, system snapshots/duplication/purge, structure entity field values/hierarchy, poll vote update/delete/results, check-in restore, lifecycle event update, device token update/delete, key rotation retry, member photo GET, list filters and pagination; CRDT sync document type coverage verification; migration regeneration
- ~~API code quality audit~~ [COMPLETED] — four-phase audit covering security (auth, validation, rate limiting), type safety (catch parameters, cast removal), code patterns (best practices), and refactoring/simplification; response envelope normalization and idempotency standardization
- ~~Comprehensive E2E test expansion~~ [COMPLETED] — expanded Playwright suite to cover blobs, custom fronts, groups, fronting, polls, board messages, private notes, lifecycle events, webhooks, notifications, and timers
- Public REST API audit (features.md section 9)
- Email & webhook audit findings
- Integration guides (features.md section 9)

## Milestone 8: App Foundation & Data Layer

Goal: App skeleton, navigation infrastructure, provider tree, and the complete data interaction layer — every React Query hook, auth flow, encryption pipeline, sync client, and offline queue needed to power the client app.

Epics:

- App shell & navigation
- Provider tree & auth flow
- Sync & offline client
- Identity data hooks
- Fronting data hooks
- Communication data hooks
- Social data hooks
- Structure & journaling data hooks
- Utility data hooks
- Web platform data adapter

## Milestone 9: UI/UX Design

Goal: Stitch-generated HTML mockups for every screen family, establishing visual language, interaction patterns, and layout decisions before React Native code is written.

Epics:

- Design system foundation
- Onboarding & auth screen designs
- Home & navigation design
- Member management screen designs
- Fronting screen designs
- Communication screen designs
- Privacy & social screen designs
- System structure screen designs
- Journaling screen designs
- Search & settings screen designs

## Milestone 10: UI/UX Buildout

Goal: Translate Stitch HTML mockups into React Native/Expo components with placeholder data. Every screen navigable and visually complete, but not wired to real data.

Epics:

- Component library implementation
- Onboarding & auth screen buildout
- Home & navigation buildout
- Member management screen buildout
- Fronting screen buildout
- Communication screen buildout
- Privacy & social screen buildout
- System structure screen buildout
- Journaling screen buildout
- Search & settings screen buildout
- Platform adaptation

## Milestone 11: Data Interpolation

Goal: Wire every screen to its real data hooks from M8, replacing placeholder/mock data with live API data. Handle loading states, error states, and verify end-to-end flows.

Epics:

- Auth & onboarding wiring
- Home & navigation wiring
- Member management wiring
- Fronting wiring
- Communication wiring
- Social wiring
- System structure wiring
- Journaling wiring
- Search & settings wiring
- Real-time & sync integration
- End-to-end flow verification

## Milestone 12: Ancillary Features

Goal: Self-contained features with their own data logic and UI, built end-to-end as complete vertical slices.

Epics:

- Simply Plural import
- PluralKit import
- Data export
- PluralKit bridge
- Littles Safe Mode
- Fronting history report generation

## Milestone 13: Self-Hosted

Goal: Two-tier self-hosted deployment (ADR 012)

Epics:

- SQLite backend adapter
- Minimal self-hosted tier (features.md section 18)
- Full self-hosted tier (features.md section 18)
- Self-hosted setup wizard
- Capability matrix documentation
- Self-hosted documentation

## Milestone 14: Polish and Launch

Goal: Security audit, performance, beta testing

Epics:

- Security audit
- Performance optimization
- Accessibility audit (features.md section 13)
- Beta program
- Cosmetic monetization (features.md section 20)
- Migration guide

## Future (unscheduled)

These features are tracked but may be deferred past initial launch. Each has a detailed design document in `docs/future-features/`.

- Inter-system messaging (features.md section 5)
- Widget support (features.md section 19) — [future feature doc](../future-features/001-widget-support.md)
- Official client SDKs (features.md section 9) — [future feature doc](../future-features/003-client-sdks.md)
- Multi-system support verification (L6) and system duplication (L7)
- System snapshots (L10, ADR 022)
- Member onboarding resources — [future feature doc](../future-features/004-member-onboarding-resources.md)
- Linked fronting — [future feature doc](../future-features/005-linked-fronting.md)
- Outtrigger analytics — [future feature doc](../future-features/006-outtrigger-analytics.md)
- Traumaversary tracking — [future feature doc](../future-features/007-traumaversary-tracking.md)
- Therapist journal report — [future feature doc](../future-features/008-therapist-journal-report.md)
- Journal custom fields — [future feature doc](../future-features/009-journal-custom-fields.md)
- Journal fronting context — [future feature doc](../future-features/010-journal-fronting-context.md)
- Member creation templates — [future feature doc](../future-features/011-member-templates.md)
- Custom lifecycle event types — [future feature doc](../future-features/012-custom-lifecycle-events.md)
- Cosmetic monetization — [future feature doc](../future-features/002-monetization-cosmetics.md)

## Architecture Decision Records

30 accepted ADRs cover the full stack:

- [ADR 001: AGPL-3.0 License](../adr/001-agpl-3-license.md)
- [ADR 002-008](../adr/) — Foundation decisions (frontend, API, database, sync, encryption, real-time, runtime)
- [ADR 009: Blob/Media Storage](../adr/009-blob-media-storage.md) — S3-compatible encrypted media, MinIO for self-hosted, local filesystem fallback
- [ADR 010: Background Job Architecture](../adr/010-background-jobs.md) — BullMQ (Valkey) for hosted, SQLite-backed fallback for self-hosted
- [ADR 011: Key Lifecycle and Recovery](../adr/011-key-recovery.md) — recovery key, multi-device transfer, password reset semantics
- [ADR 012: Self-Hosted Deployment Tiers](../adr/012-self-hosted-tiers.md) — minimal (single binary) vs full (Docker Compose), capability matrix
- [ADR 013: API Authentication with E2E Encryption](../adr/013-api-auth-encryption.md) — hybrid metadata + crypto key model, scoped access, key creation UX
- [ADR 014: Lazy Key Rotation](../adr/014-lazy-key-rotation.md) — per-bucket lazy rotation with server-side ledger
- [ADR 015: Push Token Plaintext](../adr/015-push-token-plaintext.md) — push tokens stored in plaintext (server-side only, not user content)
- [ADR 016: Messages Partitioning](../adr/016-messages-partitioning.md) — hash-based partitioning for the messages table
- [ADR 017: Audit Log Partitioning](../adr/017-audit-log-partitioning.md) — time-based partitioning with automated retention
- [ADR 018: Encryption-at-Rest Boundary](../adr/018-encryption-at-rest-boundary.md) — DB-layer encryption boundary for tier-2/tier-3 data
- [ADR 019: Fronting Sessions Partitioning](../adr/019-fronting-sessions-partitioning.md) — time-based partitioning for active fronting session performance
- [ADR 020: RLS Denormalization](../adr/020-rls-denormalization.md) — cached system_id/account_id on all tables for RLS policy efficiency
- [ADR 021: Non-System Account Model](../adr/021-non-system-accounts.md) — viewer accounts, account-level friend connections
- [ADR 022: System Structure Snapshots](../adr/022-system-snapshots.md) — point-in-time structure captures, manual and scheduled triggers
- [ADR 023: Zod-Type Alignment](../adr/023-zod-type-alignment.md) — strategy for keeping Zod validation schemas synchronized with TypeScript types
- [ADR 024: Device Transfer Code Entropy](../adr/024-device-transfer-code-entropy.md) — entropy trade-off for user-typed device transfer codes
- [ADR 025: Webhook Secret Storage](../adr/025-webhook-secret-storage.md) — T3 plaintext storage for webhook signing secrets
- [ADR 026: Lifecycle Event Type-Specific Validation](../adr/026-lifecycle-event-type-validation.md) — type-discriminated validation for lifecycle event subtypes
- [ADR 027: Webhook Secret Rotation](../adr/027-webhook-secret-rotation.md) — procedure for rotating webhook HMAC signing secrets
- [ADR 028: Opt-in IP Audit Logging](../adr/028-opt-in-ip-audit-logging.md) — IP address and user-agent audit logging is opt-in per account (default off)
- [ADR 029: Server-Side Encrypted Email](../adr/029-server-side-encrypted-email.md) — AES-256-GCM encryption for server-held email addresses (BLAKE2b hash preserved for lookup)
- [ADR 030: Email Provider Selection](../adr/030-email-provider-selection.md) — Resend for hosted, Nodemailer/SMTP for self-hosted, stub for dev

## Development Sequence Rationale

1. **Types, DB, Crypto, Sync Design** (M1): Everything depends on the domain model. Encryption tiers affect how data is stored. The sync protocol must be co-designed with the DB schema — retrofitting CRDT sync onto an existing schema guarantees rework.
2. **API Core** (M2): CRUD operations are the foundation for everything above. Auth gates all other endpoints. Recovery key generation happens at registration.
3. **Sync and Real-Time** (M3): With sync protocol designed in M1, implementation happens early so every subsequent feature is built on top of the sync layer rather than retrofitted. Multi-device key recovery also lives here.
4. **Fronting, Communication, Privacy** (M4-M6): Ordered by complexity and dependency. Fronting is the most-used feature. Communication builds on member identity. Privacy governs visibility of everything and integrates the three-tier encryption model.
5. **Data Portability** (M7): Email notifications, webhook enhancements, and public API audit — infrastructure that supports external integration. Import/export and bridge features moved to M8 since they require the client app.
6. **Client App** (M8): UI consumes the API. Building it after the API is stable prevents constant frontend rework. Includes import/export, PluralKit bridge, and API key management since these are client-side features. In practice, M8 epics will be developed in parallel with M2-M7 (each API feature gets its corresponding UI). Targets web, iOS, and Android via Expo.
7. **Self-Hosted** (M9): Two-tier model — minimal single binary for personal use, full Docker Compose for feature parity. Depends on the SQLite adapter and full feature set being stable.
8. **Polish** (M10): Final hardening pass before public launch.
