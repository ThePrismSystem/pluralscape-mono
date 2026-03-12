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

## Milestone 1: Data Layer [IN PROGRESS]

Goal: Domain types, database schema, encryption primitives, sync protocol design, i18n foundation

Epics:

- ~~Domain types (`packages/types`)~~ [COMPLETED] — 30+ domain type modules with Zod validators and branded IDs
- ~~Database schema (`packages/db`)~~ [COMPLETED] — 40+ tables, dual-dialect (PG + SQLite), RLS, constraint closure, encryption contracts
- ~~Database schema hardening~~ [COMPLETED] — 29 tasks: indexes, encryption, sync queue fixes, full-text search, varchar right-sizing
- ~~Test framework setup~~ [COMPLETED] — Vitest workspace, coverage enforcement, test factories (2,338 tests)
- Encryption layer (`packages/crypto`) — ADR 006 (foundation complete: key derivation, symmetric crypto, identity keypairs; remaining: per-bucket keys, key rotation, recovery)
- Sync protocol design (`packages/sync`) — ADR 005 (encrypted CRDT relay PoC complete; remaining: document topology, conflict resolution, partial replication)
- Blob storage strategy — ADR 009
- Background job infrastructure — ADR 010
- Key recovery protocol — ADR 011
- i18n infrastructure (features.md section 11)
- Nomenclature system (features.md section 12)
- Database schema documentation (ER diagram pending)

## Milestone 2: API Core

Goal: Authentication, identity management, core CRUD

Epics:

- Auth system (features.md section 14)
- Member CRUD (features.md section 1)
- Groups and folders (features.md section 1)
- Custom fronts (features.md section 1)
- System settings (features.md section 12)
- Initial setup wizard
- System structure data model (features.md section 6)
- Media upload pipeline (features.md section 16)

## Milestone 3: Sync and Real-Time

Goal: Sync implementation, WebSocket transport, offline resilience

Epics:

- CRDT sync implementation (`packages/sync`)
- WebSocket server (features.md section 15)
- SSE fallback
- Offline queue and replay
- Conflict resolution
- Multi-device key transfer (ADR 011)

## Milestone 4: Fronting Engine

Goal: Front logging, co-fronting, analytics, timers

Epics:

- Front logging API (features.md section 2)
- Analytics engine (features.md section 2)
- Fronting history report generation (features.md section 2)
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

- Privacy buckets (features.md section 4)
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

These features are tracked but may be deferred past initial launch.

- Inter-system messaging (features.md section 5)
- Widget / wearable support (features.md section 19)
- Official client SDKs (features.md section 9)

## Architecture Decision Records

18 accepted ADRs cover the full stack:

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

## Development Sequence Rationale

1. **Types, DB, Crypto, Sync Design** (M1): Everything depends on the domain model. Encryption tiers affect how data is stored. The sync protocol must be co-designed with the DB schema — retrofitting CRDT sync onto an existing schema guarantees rework.
2. **API Core** (M2): CRUD operations are the foundation for everything above. Auth gates all other endpoints. Recovery key generation happens at registration.
3. **Sync and Real-Time** (M3): With sync protocol designed in M1, implementation happens early so every subsequent feature is built on top of the sync layer rather than retrofitted. Multi-device key recovery also lives here.
4. **Fronting, Communication, Privacy** (M4-M6): Ordered by complexity and dependency. Fronting is the most-used feature. Communication builds on member identity. Privacy governs visibility of everything and integrates the three-tier encryption model.
5. **Data Portability** (M7): Import/export can be built once the data model is stable. Imports run client-side (encrypted data). Doing it too early risks rework as the schema evolves.
6. **Client App** (M8): UI consumes the API. Building it after the API is stable prevents constant frontend rework. In practice, M8 epics will be developed in parallel with M2-M7 (each API feature gets its corresponding UI). Targets web, iOS, and Android via Expo.
7. **Self-Hosted** (M9): Two-tier model — minimal single binary for personal use, full Docker Compose for feature parity. Depends on the SQLite adapter and full feature set being stable.
8. **Polish** (M10): Final hardening pass before public launch.
