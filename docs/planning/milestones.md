# Development Milestones

Target: full feature parity with Simply Plural plus new features.

Milestones are ordered by dependency, not as a waterfall schedule. In practice, development proceeds vertically — one feature end-to-end (types, schema, API, UI, tests) rather than completing entire horizontal layers before moving on.

## Milestone 0: Foundation [COMPLETED]

Goal: Monorepo infrastructure, tooling, governance

- Monorepo scaffolding (pnpm, turbo, shared tooling)
- Architecture decisions (8 ADRs)
- CI/CD pipeline (lint, typecheck)
- Public repo setup (branch protection, issue templates, dependabot)
- License audit

## Milestone 1: Data Layer

Goal: Domain types, database schema, encryption primitives, sync protocol design, i18n foundation

Epics:

- Domain types (packages/types) — system, member, fronting, chat, privacy bucket, etc.
- Database schema (packages/db) — Drizzle schema for PostgreSQL + SQLite, co-designed with CRDT sync requirements
- Encryption layer (packages/crypto) — libsodium wrappers, key derivation, per-bucket keys, three-tier encryption model (ADR 006)
- Sync protocol design (packages/sync) — Automerge document structure, merge semantics, conflict resolution rules; co-designed with DB schema so sync is not retrofitted
- Blob storage strategy — S3-compatible encrypted media storage, MinIO for self-hosted, local filesystem fallback (ADR 009)
- Background job infrastructure — BullMQ (Valkey) for hosted, SQLite-backed in-process queue for self-hosted (ADR 010)
- Key recovery protocol — recovery key generation, multi-device key transfer (ADR 011)
- i18n infrastructure — string externalization framework, locale loading, RTL support
- Nomenclature system — configurable terminology for 8 term categories (collective, individual, fronting, switching, co-presence, internal space, primary fronter, structure), UI-only (canonical API terms), stored per-system
- Test framework setup — Vitest configuration, coverage thresholds, CI enforcement

## Milestone 2: API Core

Goal: Authentication, identity management, core CRUD

Epics:

- Auth (registration, login, sessions, recovery key generation, biometric token)
- Member CRUD (profiles, custom fields, multi-photo galleries with crop/resize, multiple colors, role tags, fragment/demi/full completeness, archival/restore)
- Groups/folders (CRUD, hierarchy, multi-membership, ordering, image/color/emoji, move/copy between folders)
- Custom fronts (CRUD, treated like members in DB)
- System settings (nomenclature preferences, notification config, timezone)
- Initial setup wizard (nomenclature selection, basic system profile, recovery key backup prompt)
- System structure data model (recursive tree, typed directed relationships, nested subsystems, side systems, layers, architecture types, lifecycle events: split/fusion/merge/dormancy)
- Media upload pipeline (client-side encrypt, crop/resize, thumbnail generation, S3 upload)

## Milestone 3: Sync and Real-Time

Goal: Sync implementation, WebSocket transport, offline resilience

Epics:

- CRDT sync implementation (packages/sync — Automerge integration, encrypted sync payloads)
- WebSocket server (live fronting updates, chat messages)
- SSE fallback (notifications, status updates)
- Offline queue and replay (cryptographic confirmation before clearing local)
- Conflict resolution (CRDT merge semantics for concurrent edits, application-level rules for relational conflicts like orphaned entities)
- Multi-device key transfer (encrypted device-to-device key exchange for recovery)

## Milestone 4: Fronting Engine

Goal: Front logging, co-fronting, analytics, timers

Epics:

- Front logging API (start/end/switch, co-fronting vs co-conscious, subsystem-level fronting, retroactive edits, comments, custom front status text)
- Analytics engine (duration calculations, date range queries, per-member stats)
- Fronting history report generation (client-side HTML/PDF export)
- Automated timers / check-in reminders (scheduled notifications, waking hours)
- Webhooks — event system for front changes (encrypted payloads, extensible to other actions)

## Milestone 5: Communication

Goal: Internal messaging, boards, notes, polls

Epics:

- Chat system (channels, proxy messaging, rich text, @mentions)
- Board messages (CRUD, ordering, persistence)
- Private notes (member-bound, system-wide, rich text)
- Polls (creation, voting, cooperative one-vote-per-member enforcement)
- Mandatory acknowledgement routing (targeted persistent alerts, cooperative enforcement)
- Webhooks — events for messages, board updates

## Milestone 6: Privacy and Social

Goal: Privacy engine, friend network, external access

Epics:

- Privacy buckets (CRUD, content tagging, intersection logic, fail-closed enforcement, custom field visibility per-bucket, three-tier encryption integration)
- Friend network (friend codes, connection management, bucket assignment)
- External dashboard (active fronters with custom fronts/status, member list, custom fields — all filtered by privacy buckets)
- Friend-side search (pull bucket-permitted data locally for client-side search within friend's visible data)
- Push notifications (switch alerts to friends via tier 3 metadata triggers, configurable)
- Report generation (client-side: member report by privacy bucket, "meet our system" shareable report)

## Milestone 7: Data Portability

Goal: Import from SP/PK, export, API surface

Epics:

- Simply Plural import (client-side: parse SP JSON export — raw MongoDB dump, epoch ms timestamps, ObjectId refs, separate avatar ZIP; chunked processing for large imports)
- PluralKit import (client-side: parse PK JSON v2 export — 5-char hids, ISO 8601, members/switches/groups only)
- Data export (JSON/CSV, all user data; client-side HTML/PDF reports)
- PluralKit bridge (bidirectional sync via API token; runs client-side since server cannot decrypt)
- Public REST API (full endpoint surface, canonical terms, hybrid auth model with metadata + crypto keys, rate limiting, documentation) (ADR 013)
- API key management UI (intuitive key creation with plain-language scope descriptions, visual indicators, key lifecycle dashboard)
- Webhooks — user-configurable webhook endpoints for all supported events (tier 3 metadata default, optional encrypted payloads)
- Integration guides (Python, JavaScript/TypeScript, Go, Rust, C# — authentication, metadata endpoints, encrypted data decryption)

## Milestone 8: Client App

Goal: Full-featured cross-platform UI (web, iOS, Android via Expo)

Epics:

- Navigation and app shell (expo-router, tab/stack navigation)
- Member management screens (list, detail, edit, custom fields, groups, image crop/resize)
- Fronting UI (quick-switch, timeline view, co-fronting, analytics charts)
- Chat UI (channel list, proxy messaging, rich text input)
- Board and notes UI
- Privacy and friends UI (bucket management, friend dashboard, friend-side search)
- System structure UI (relationship editor, subsystem management, visual canvas)
- Journaling UI (block editor, wiki linking)
- Search UI (global search bar, entity-type filters, result previews)
- Settings (nomenclature, i18n, notifications, security, import/export, recovery key management)
- Littles Safe Mode (simplified interface, configurable safe content: links/videos)
- Offline-first integration (local SQLite, sync indicators, queue-based writes)
- Web-specific concerns (browser crypto via WebAssembly libsodium, no background sync, PWA considerations)

## Milestone 9: Self-Hosted

Goal: Two-tier self-hosted deployment (ADR 012)

Epics:

- SQLite backend adapter (Drizzle dual-target: PostgreSQL + SQLite)
- Minimal tier: Bun-compiled single binary, SQLite, local filesystem blobs, in-process job queue, polling-only (no Valkey/WebSocket/push)
- Full tier: Docker Compose with PostgreSQL, Valkey, MinIO, WebSocket support, BullMQ, push notifications
- First-run setup wizard
- Capability matrix documentation (what degrades in minimal vs full tier)
- Self-hosted documentation

## Milestone 10: Polish and Launch

Goal: Security audit, performance, beta testing

Epics:

- Security audit (penetration testing, encryption verification, privacy bucket edge cases, key recovery flows)
- Performance optimization (query tuning, bundle size, cold start, large-system performance with 1000+ members)
- Accessibility audit (screen reader testing, WCAG validation)
- Beta program (staged rollout, feedback collection)
- Cosmetic monetization (premium themes, avatar frames, supporter badges)
- Migration guide (SP to Pluralscape step-by-step for end users)

## Future (unscheduled)

These features are tracked but may be deferred past initial launch.

- Inter-system messaging (external DMs between members of different systems, per-member inboxes, privacy-controlled)
- Widget / wearable support (home screen widgets, Apple Watch for quick front switching)
- Official client SDKs (Python, JavaScript/TypeScript, Go, Rust, C# — handle authentication and libsodium decryption for third-party developers)

## Architecture Decision Records

All ADRs for the current milestone plan have been accepted:

- [ADR 009: Blob/Media Storage](../adr/009-blob-media-storage.md) — S3-compatible encrypted media, MinIO for self-hosted, local filesystem fallback
- [ADR 010: Background Job Architecture](../adr/010-background-jobs.md) — BullMQ (Valkey) for hosted, SQLite-backed fallback for self-hosted
- [ADR 011: Key Lifecycle and Recovery](../adr/011-key-recovery.md) — recovery key, multi-device transfer, password reset semantics
- [ADR 012: Self-Hosted Deployment Tiers](../adr/012-self-hosted-tiers.md) — minimal (single binary) vs full (Docker Compose), capability matrix

- [ADR 013: API Authentication with E2E Encryption](../adr/013-api-auth-encryption.md) — hybrid metadata + crypto key model, scoped access, key creation UX

See also: [ADR 002-008](../adr/) for earlier foundation decisions.

## Development Sequence Rationale

1. **Types, DB, Crypto, Sync Design** (M1): Everything depends on the domain model. Encryption tiers affect how data is stored. The sync protocol must be co-designed with the DB schema — retrofitting CRDT sync onto an existing schema guarantees rework.
2. **API Core** (M2): CRUD operations are the foundation for everything above. Auth gates all other endpoints. Recovery key generation happens at registration.
3. **Sync and Real-Time** (M3): With sync protocol designed in M1, implementation happens early so every subsequent feature is built on top of the sync layer rather than retrofitted. Multi-device key recovery also lives here.
4. **Fronting, Communication, Privacy** (M4-M6): Ordered by complexity and dependency. Fronting is the most-used feature. Communication builds on member identity. Privacy governs visibility of everything and integrates the three-tier encryption model.
5. **Data Portability** (M7): Import/export can be built once the data model is stable. Imports run client-side (encrypted data). Doing it too early risks rework as the schema evolves.
6. **Client App** (M8): UI consumes the API. Building it after the API is stable prevents constant frontend rework. In practice, M8 epics will be developed in parallel with M2-M7 (each API feature gets its corresponding UI). Targets web, iOS, and Android via Expo.
7. **Self-Hosted** (M9): Two-tier model — minimal single binary for personal use, full Docker Compose for feature parity. Depends on the SQLite adapter and full feature set being stable.
8. **Polish** (M10): Final hardening pass before public launch.
