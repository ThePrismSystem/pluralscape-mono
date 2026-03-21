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
- ~~System structure data model~~ [COMPLETED] — subsystems, side-systems, layers, relationships, structure links, structure memberships with generic CRUD extraction
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

## Milestone 4: Fronting Engine

Goal: Front logging, co-fronting, analytics, timers

Epics:

- Front logging API (features.md section 2), including outtrigger reason/sentiment (L5) and fronting structure location display (L1)
- Analytics engine (features.md section 2)
- Automated timers and check-in reminders (features.md section 2)
- Webhooks event system

## Milestone 5: Communication

Goal: Internal messaging, boards, notes, polls

Epics:

- Chat system (features.md section 3)
- Board messages (features.md section 3)
- Private notes (features.md section 3)
- Polls (features.md section 3)
- Mandatory acknowledgement routing (features.md section 3)
- Communication webhooks

## Milestone 6: Privacy and Social

Goal: Privacy engine, friend network, external access

Epics:

- Privacy buckets (features.md section 4), including non-system account impact on friend model (L2)
- Friend network (features.md section 4)
- External dashboard (features.md section 4)
- Friend-side search (features.md section 8)
- Push notifications (features.md section 4)
- Report generation (features.md section 10)

## Milestone 7: Data Portability

Goal: Import from SP/PK, export, API surface

Epics:

- Simply Plural import (features.md section 10)
- PluralKit import (features.md section 10)
- Data export (features.md section 10)
- PluralKit bridge (features.md section 9)
- Public REST API — ADR 013 (features.md section 9)
- API key management UI (features.md section 9)
- User-configurable webhooks (features.md section 9)
- Integration guides (features.md section 9)

## Milestone 8: Client App

Goal: Full-featured cross-platform UI (web, iOS, Android via Expo)

Epics:

- Navigation and app shell
- Member management screens
- Fronting UI
- Chat UI
- Board and notes UI
- Privacy and friends UI
- System structure UI
- Journaling UI (features.md section 7)
- Search UI (features.md section 8)
- Settings screens
- Fronting history report generation (features.md section 2)
- Littles Safe Mode (features.md section 13)
- Offline-first client integration (features.md section 15)
- Web platform support

## Milestone 9: Self-Hosted

Goal: Two-tier self-hosted deployment (ADR 012)

Epics:

- SQLite backend adapter
- Minimal self-hosted tier (features.md section 18)
- Full self-hosted tier (features.md section 18)
- Self-hosted setup wizard
- Capability matrix documentation
- Self-hosted documentation

## Milestone 10: Polish and Launch

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

26 accepted ADRs cover the full stack:

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

## Development Sequence Rationale

1. **Types, DB, Crypto, Sync Design** (M1): Everything depends on the domain model. Encryption tiers affect how data is stored. The sync protocol must be co-designed with the DB schema — retrofitting CRDT sync onto an existing schema guarantees rework.
2. **API Core** (M2): CRUD operations are the foundation for everything above. Auth gates all other endpoints. Recovery key generation happens at registration.
3. **Sync and Real-Time** (M3): With sync protocol designed in M1, implementation happens early so every subsequent feature is built on top of the sync layer rather than retrofitted. Multi-device key recovery also lives here.
4. **Fronting, Communication, Privacy** (M4-M6): Ordered by complexity and dependency. Fronting is the most-used feature. Communication builds on member identity. Privacy governs visibility of everything and integrates the three-tier encryption model.
5. **Data Portability** (M7): Import/export can be built once the data model is stable. Imports run client-side (encrypted data). Doing it too early risks rework as the schema evolves.
6. **Client App** (M8): UI consumes the API. Building it after the API is stable prevents constant frontend rework. In practice, M8 epics will be developed in parallel with M2-M7 (each API feature gets its corresponding UI). Targets web, iOS, and Android via Expo.
7. **Self-Hosted** (M9): Two-tier model — minimal single binary for personal use, full Docker Compose for feature parity. Depends on the SQLite adapter and full feature set being stable.
8. **Polish** (M10): Final hardening pass before public launch.
