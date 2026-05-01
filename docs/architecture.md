# Pluralscape Architecture Overview

Canonical reference for system topology, package dependencies, data flow, and key design decisions.
Community terminology is used throughout: "system" (not patient), "member" (not alter), "fronting" (not presenting).

---

## 1. System Topology

### Hosted Deployment

```
┌─────────────────────────────────────────────────────────────┐
│  Expo Client (iOS / Android / Web)                          │
│  React Native + expo-router                                 │
│  Local SQLite/SQLCipher  ←── source of truth                │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS
                               │ tRPC (internal) / REST (public)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Hono API  (Bun runtime)                                    │
│  tRPC router + REST routes                                  │
│  Auth middleware  ·  Row-Level Security (PostgreSQL)        │
└────────────┬──────────────┬──────────────┬──────────────────┘
             │              │              │
             ▼              ▼              ▼
        PostgreSQL        Valkey        S3 / MinIO
        (primary DB)    (cache/pub-sub) (blob storage)
```

On iOS and Android the client uses `expo-sqlite` with SQLCipher. On web, the client substitutes OPFS-backed `wa-sqlite` (with an IndexedDB fallback for browsers that lack OPFS), preserving the same SQLite-shaped adapter interfaces — see [adr/031-web-storage-backend.md](adr/031-web-storage-backend.md).

### Self-Hosted Deployment

```
┌─────────────────────────────────────────────────────────────┐
│  Expo Client                                                │
│  Local SQLite/SQLCipher                                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (local network / Tailscale)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Hono API  (Bun single binary)                              │
│  SQLite/SQLCipher + local filesystem                        │
│  No PostgreSQL, no Valkey, no S3                            │
│  Minimal tier: personal use                                 │
│  Full tier: Docker Compose (feature parity with hosted)     │
└─────────────────────────────────────────────────────────────┘
```

### Offline-First Model

```
Local SQLite  ──── source of truth ────▶  UI / React Query
     │
     │  background sync
     ▼
Offline queue  ──▶  CRDT merge  ──▶  Encrypted relay  ──▶  Server
                                       (opaque ciphertext;       │
                                        server cannot read)      │
                                                                 ▼
Receiving client  ◀──  decrypt  ◀──  fan-out  ◀──  persist
     │
     ▼
Materializer  ──▶  React Query invalidation  ──▶  UI re-render
```

The server persists and relays ciphertext it cannot decrypt. All plaintext lives exclusively on the client.

### Three Drizzle Schema Sets

Domain entities have three on-disk representations, each a Drizzle schema in `packages/db/src/schema/` — see [adr/038-three-drizzle-schema-sets.md](adr/038-three-drizzle-schema-sets.md):

- `schema/pg/` — server PostgreSQL. Encrypted-blob + structural columns; zero-knowledge.
- `schema/sqlite/` — server SQLite for self-hosted deployments and the queue package. Same shape as PG.
- `schema/sqlite-client-cache/` — mobile/web local cache. Plaintext columns projected from CRDT documents by the materializer; the UI reads via TanStack Query subscriptions.

A shared mixin layer (`packages/db/src/helpers/entity-shape.{sqlite,pg}.ts`) supplies structural columns and indexes across all three sets.

---

## 2. Package Dependency Graph

Tooling packages (`eslint-config`, `prettier-config`, `tsconfig`, `test-utils`) are omitted — every package depends on them as devDependencies.

```
                       ┌─────────┐
                       │  types  │  (leaf — no @pluralscape deps)
                       └────┬────┘
            ┌───────────────┼──────────────────────────────┐
            │               │                              │
            ▼               ▼                              ▼
        ┌──────┐     ┌────────────┐                ┌────────────┐
        │crypto│     │ validation │                │    i18n    │  (types)
        └──┬───┘     └─────┬──────┘                └────────────┘
           │               │
      ┌────┴────┐      ┌────┘
      │         │      │
      ▼         ▼      ▼
   ┌────┐     ┌──────────────────┐
   │ db │     │      sync        │  (types + crypto + validation)
   └──┬─┘     └──────────────────┘
      │
      ▼
  ┌───────┐
  │ queue │  (types + db)
  └───────┘

  ┌──────────────────┐
  │  rotation-worker │  (types + crypto)
  └──────────────────┘

  ┌─────────┐
  │ storage │  (types)
  └─────────┘

  ┌───────┐
  │ email │  (no @pluralscape deps)
  └───────┘

  ┌────────┐
  │ logger │  (types)
  └────────┘

  ┌────────────┐
  │ api-client │  (depends on @pluralscape/api for router types)
  └────────────┘

  ┌──────┐
  │ data │  (api-client + crypto + types)
  └──────┘

  ┌─────────────┐
  │ import-core │  (types)
  └──────┬──────┘
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────────┐  ┌───────────┐
│ import-sp │  │ import-pk │  (import-core + types + validation; import-pk also depends on data)
└───────────┘  └───────────┘
```

`packages/import-core` is the shared orchestration engine (dependency-ordered walks, checkpoint-based resumption, error classification, bounded warning buffers, `Persister` boundary) behind both SP and PK imports — see [adr/034-import-core-extraction.md](adr/034-import-core-extraction.md).

### Classification

| Category    | Packages                                                                |
| ----------- | ----------------------------------------------------------------------- |
| Server-only | `db`, `queue`, `rotation-worker`, `email`                               |
| Client-only | `api-client`, `data`, `import-core`, `import-sp`, `import-pk`, `logger` |
| Shared      | `types`, `crypto`, `sync`, `validation`, `i18n`, `storage`              |

### App Consumers

| App            | Packages consumed                                                              |
| -------------- | ------------------------------------------------------------------------------ |
| `apps/api`     | `crypto`, `db`, `email`, `queue`, `storage`, `sync`, `types`, `validation`     |
| `apps/mobile`  | `api-client`, `crypto`, `data`, `i18n`, `import-sp`, `logger`, `sync`, `types` |
| `apps/api-e2e` | `api` (for router types), `crypto`, `sync`, `types`                            |

---

## 3. Data Flow

### Request Lifecycle (Online)

```
Client                          Server
  │                               │
  │  1. encrypt payload           │
  │     (XChaCha20-Poly1305)      │
  │                               │
  ├─── tRPC mutation ────────────▶│
  │                               │  2. auth middleware
  │                               │     (JWT / session token)
  │                               │
  │                               │  3. RLS enforcement
  │                               │     (PostgreSQL row-level)
  │                               │
  │                               │  4. service layer
  │                               │     (business logic)
  │                               │
  │                               │  5. database write
  │                               │
  │◀─── response ─────────────────│
  │                               │
  │  6. decrypt response          │
  │     (client holds keys)       │
```

### Sync Flow

```
Local mutation
     │
     ▼
Offline queue  ──▶  CRDT merge (conflict resolution)
                         │
                         ▼
                    Client encrypts delta
                         │
                         ▼
                    tRPC mutation  ──▶  Server persists opaque ciphertext
                                              │
                                              ▼
                                         Valkey pub-sub fan-out
                                              │
                                              ▼
                                    Receiving client(s) pull delta
                                              │
                                              ▼
                                    Client decrypts with bucket key
                                              │
                                              ▼
                                    Materializer applies to local SQLite
                                              │
                                              ▼
                                    React Query invalidation → UI
```

### Encryption Boundaries

| Tier                  | Scope                                                  | Algorithm                                              | Key holder                                       |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| T1 — User content     | Member profiles, journal entries, front logs, messages | XChaCha20-Poly1305 (libsodium)                         | Client only; server sees ciphertext              |
| T2 — Operational data | Email addresses, webhook URLs                          | XChaCha20-Poly1305 (BLAKE2b hash preserved for lookup) | Server; encrypted at rest, decrypted transiently |
| T3 — Infrastructure   | Push tokens, session metadata                          | Plaintext (TLS in transit)                             | Server; no application-level encryption          |

Per-bucket symmetric keys are derived client-side. The server never holds T1 key material.

### Service Layer Structure

API services live in `apps/api/src/services/<domain>/<verb>.ts` (Option E — per-verb file layout, no barrels). Callers import directly from the verb file (e.g., `services/member/create.ts`); there is no `services/<domain>/index.ts` re-export. Shared types and helpers live in `services/<domain>/internal.ts` only when consumed by two or more verb files; single-consumer helpers stay local. The service tree mirrors `apps/api/src/routes/`.

A shared `checkDependents` helper enforces the deliberate-data-lifecycle 409 contract uniformly across verbs.

### LOC Ceilings

File-size limits are codified as ESLint `max-lines` rules in `tooling/eslint-config/loc-rules.js` rather than enforced ad-hoc. Notable ceilings: `services/**/*.ts` 450, `routes/**/*.ts` 200, `trpc/**/*.ts` 350, `middleware/**/*.ts` 200, `mobile/src/**` 500, `packages/types/src/**` 450, `packages/sync/src/**` 750. CI fails on overflow; the fix is to split the file along its natural seams, never to add an override comment.

### Canonical type chain (types-as-SoT)

Every encrypted entity exposes a six-link chain from `@pluralscape/types`:
`<Entity>` (decrypted domain) → `<Entity>EncryptedFields` (keys union) →
`<Entity>EncryptedInput = Pick<<Entity>, <Entity>EncryptedFields>` →
`<Entity>ServerMetadata` (Drizzle row) → `<Entity>Result =
EncryptedWire<<Entity>ServerMetadata>` → `<Entity>Wire =
Serialize<<Entity>Result>`. Drizzle parity (`packages/db`), Zod parity
(`packages/validation`), and OpenAPI G7 parity (`scripts/openapi-wire-parity.type-test.ts`)
all assert structural equality against the appropriate slot. `pnpm types:check-sot`
runs the gate; CI blocks on failure. See [adr/023-zod-type-alignment.md](adr/023-zod-type-alignment.md).

Client transforms in `packages/data/src/transforms/` consume this chain
function-only — local domain/wire/encrypted-input aliases are forbidden.
Runtime validation of decrypted blobs is delegated to
`<Entity>EncryptedInputSchema.parse()` from `@pluralscape/validation`.

---

## 4. Key Architecture Decisions

| Pattern             | Decision                                                                                           | ADR                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| License             | AGPL-3.0 — copyleft to protect community data                                                      | [adr/001-agpl-3-license.md](adr/001-agpl-3-license.md)                             |
| Frontend framework  | React Native via Expo — single codebase for iOS, Android, Web                                      | [adr/002-frontend-framework.md](adr/002-frontend-framework.md)                     |
| API framework       | Hono on Bun — fast, edge-compatible, supports Bun native APIs                                      | [adr/003-api-framework.md](adr/003-api-framework.md)                               |
| Database            | PostgreSQL (hosted) + SQLite/SQLCipher (client + self-hosted)                                      | [adr/004-database.md](adr/004-database.md)                                         |
| Offline sync        | CRDT-based encrypted sync; server relays opaque ciphertext                                         | [adr/005-offline-sync.md](adr/005-offline-sync.md)                                 |
| Encryption          | libsodium — XChaCha20-Poly1305, X25519, Argon2id                                                   | [adr/006-encryption.md](adr/006-encryption.md)                                     |
| Real-time           | WebSocket + SSE via tRPC subscriptions                                                             | [adr/007-realtime.md](adr/007-realtime.md)                                         |
| Runtime             | Bun — faster cold start, native SQLite, built-in test runner                                       | [adr/008-runtime.md](adr/008-runtime.md)                                           |
| Blob storage        | S3-compatible (MinIO self-hosted); pre-signed URLs                                                 | [adr/009-blob-media-storage.md](adr/009-blob-media-storage.md)                     |
| Background jobs     | BullMQ-compatible queue on Valkey                                                                  | [adr/010-background-jobs.md](adr/010-background-jobs.md)                           |
| Key recovery        | Recovery code derivation via Argon2id, sharded backup                                              | [adr/011-key-recovery.md](adr/011-key-recovery.md)                                 |
| Self-hosted tiers   | Minimal (single binary) vs Full (Docker Compose)                                                   | [adr/012-self-hosted-tiers.md](adr/012-self-hosted-tiers.md)                       |
| Encryption boundary | T1/T2/T3 classification; fail-closed on unmapped data                                              | [adr/018-encryption-at-rest-boundary.md](adr/018-encryption-at-rest-boundary.md)   |
| RLS denormalization | system_id/account_id columns on every table for RLS                                                | [adr/020-rls-denormalization.md](adr/020-rls-denormalization.md)                   |
| Email encryption    | Server-side XChaCha20-Poly1305 (AEAD); BLAKE2b hash for lookup                                     | [adr/029-server-side-encrypted-email.md](adr/029-server-side-encrypted-email.md)   |
| Web storage backend | OPFS+wa-sqlite preferred, IndexedDB fallback; auto-detected                                        | [adr/031-web-storage-backend.md](adr/031-web-storage-backend.md)                   |
| tRPC parity         | `pnpm trpc:parity` enforces REST+tRPC coverage on every PR                                         | [adr/032-trpc-parity-enforcement.md](adr/032-trpc-parity-enforcement.md)           |
| PluralKit client    | Adopt `pkapi.js` (BSD-2-Clause) for PK API v2 with built-in rate limiting                          | [adr/033-pluralkit-api-client-library.md](adr/033-pluralkit-api-client-library.md) |
| Import core         | Shared orchestration engine behind SP and PK import engines                                        | [adr/034-import-core-extraction.md](adr/034-import-core-extraction.md)             |
| i18n OTA delivery   | `i18next-chained-backend` (bundled + HTTP), API proxies Crowdin with 24h TTL                       | [adr/035-i18n-ota-delivery.md](adr/035-i18n-ota-delivery.md)                       |
| Crowdin automation  | Config-as-code glossary, DeepL+Google MT, TM+MT pre-translate, auto-merge for translation-only PRs | [adr/036-crowdin-automation.md](adr/036-crowdin-automation.md)                     |
| Argon2id profiles   | Context-specific profiles (`TRANSFER`, `MASTER_KEY`) replacing the unified parameter set           | [adr/037-argon2id-context-profiles.md](adr/037-argon2id-context-profiles.md)       |
| Three schema sets   | Server-PG, server-SQLite, client-SQLite-cache as parallel Drizzle schemas with shared mixins       | [adr/038-three-drizzle-schema-sets.md](adr/038-three-drizzle-schema-sets.md)       |
| Types as SoT        | `packages/types` is canonical for every domain entity; Drizzle, Zod, and OpenAPI parity-gated      | [adr/023-zod-type-alignment.md](adr/023-zod-type-alignment.md)                     |

---

## 5. Security Model

### Zero-Knowledge Server

The server stores only T1 ciphertext. It cannot read member profiles, journal entries, front logs, or messages. Raw passwords and master keys never reach the server. All master-key derivation, unwrap, rewrap, and recovery operations execute on the client; the server persists only the encrypted master-key blobs and the auth-key hash.

Authentication uses a split key derivation protocol (ADR 006): a single Argon2id pass over the password produces an `auth_key` (sent to the server, stored as a BLAKE2B hash) and a `password_key` (client-only, used to unwrap the master key). The server verifies a hash of the auth key — it cannot derive the password key or the master key from what it stores. Argon2id runs against context-specific profiles (`TRANSFER`, `MASTER_KEY`) rather than a single unified parameter set — see [adr/037-argon2id-context-profiles.md](adr/037-argon2id-context-profiles.md).

Per-bucket symmetric keys are generated client-side and exchanged between devices via encrypted key bundles (X25519 ECDH). Key rotation is lazy: triggered on device removal or compromise, not on every write.

### Fail-Closed Privacy

Privacy bucket membership is evaluated client-side using intersection logic. If bucket data is unavailable, corrupted, or unmapped, access defaults to maximum restriction — the system's data is never accidentally exposed. This principle extends to the API: missing or erroneous privacy context is treated as "deny".

### RLS Context Wrappers

All API queries against RLS-protected tables go through `withTenantRead` or `withTenantTransaction` (`apps/api/src/lib/rls-context.ts`), which set `app.current_system_id` and `app.current_account_id` as transaction-local GUCs before running the callback. Read variants additionally enforce `SET TRANSACTION READ ONLY` so accidental writes are rejected at the database. Bare `db.execute(...)` or `db.transaction(...)` outside these wrappers is an ESLint error; the rare cross-account paths use `withCrossAccountRead` / `withCrossAccountTransaction`. An integration regression test locks in fail-silent behavior: an un-contexted query returns an empty result set rather than rows from another tenant.

### Trust Boundary

| Layer     | Trusted for                                           | Not trusted for                |
| --------- | ----------------------------------------------------- | ------------------------------ |
| Client    | Encryption, local key custody, CRDT authorship        | Server-enforced access control |
| Server    | Auth, RLS, access control, T2/T3 data confidentiality | T1 data confidentiality        |
| Transport | TLS in transit                                        | Not applicable                 |

### Deliberate Data Lifecycle

Deleting an entity that has dependents returns HTTP 409 — no silent cascade. Foreign keys use `ON DELETE RESTRICT` for entity relationships. `ON DELETE CASCADE` applies only to `system_id` and `account_id` columns, so an account purge removes all system data atomically.

---

## 6. Development Sequence Rationale

Milestones are ordered to eliminate rework by resolving foundational dependencies first.

**M0 — Infrastructure foundation**: CI/CD, monorepo tooling, shared package scaffolding. No application logic yet; establishes the build and release pipeline.

**M1 — Types, DB, Crypto, Sync design**: Everything depends on the domain model. Encryption tiers constrain how data is stored. The sync protocol must be co-designed with the database schema — retrofitting CRDT sync onto an existing schema guarantees rework. This milestone produces the data layer but no running API.

**M2 — API core**: CRUD operations are the foundation for all subsequent features. Auth gates every endpoint; recovery key generation happens at registration. No API feature can be built before this milestone.

**M3 — Sync and real-time**: With the sync protocol designed in M1, implementation happens early so every subsequent feature is built on top of the sync layer. Multi-device key recovery also lives here. Retrofitting sync onto already-shipped features is the primary risk this avoids.

**M4–M6 — Fronting → Communication → Privacy**: Ordered by dependency. Fronting is the most-used feature and the clearest domain concept. Communication builds on member identity. Privacy governs visibility of everything and integrates the three-tier encryption model — it must come after the data it protects exists.

**M7 — Data portability**: Email notifications, webhook enhancements, and public API surface. Infrastructure that supports external integration is deferred until the core API is stable; it does not drive internal architecture.

**M8 — Client app foundation**: The mobile/web UI consumes the API. Building the client after the API is stable prevents constant frontend rework caused by breaking schema changes. API key management and the complete data hook surface are client-side features bundled here. In practice, M8 epics are developed in parallel with M2–M7 — each API feature ships with its corresponding UI.

**M9 — Data import**: Import engines are data-layer work — parsing, mapping, and persisting external data into the Pluralscape schema. Building import before UI/UX design ensures the full data surface (including imported SP and PK data) is established before screen design begins.

**M10–M11 — UI design → buildout**: Visual design system established before the buildout phase; avoids retrofitting accessibility and design tokens.

**M12 — Data interpolation**: Wire screens to tRPC hooks and local SQLite; the full offline-first experience becomes testable end-to-end.

**M13 — Ancillary features**: Vertical slices (data export, PluralKit bridge, Littles Safe Mode, fronting history reports) added after the core loop is proven stable.

**M14–M15 — Self-hosted → polish**: Self-hosted mode requires a complete, stable feature set before the SQLite adapter is meaningful. Polish is the final hardening pass before public launch.
