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
        │crypto│     │ validation │                │    i18n    │
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

  ┌────────────┐
  │ api-client │  (depends on @pluralscape/api for router types)
  └────────────┘

  ┌──────┐
  │ data │  (api-client + crypto + sync + types)
  └──────┘
```

### Classification

| Category    | Packages                                                   |
| ----------- | ---------------------------------------------------------- |
| Server-only | `db`, `queue`, `rotation-worker`, `email`                  |
| Client-only | `api-client`, `data`                                       |
| Shared      | `types`, `crypto`, `sync`, `validation`, `i18n`, `storage` |

### App Consumers

| App            | Packages consumed                                                          |
| -------------- | -------------------------------------------------------------------------- |
| `apps/api`     | `crypto`, `db`, `email`, `queue`, `storage`, `sync`, `types`, `validation` |
| `apps/mobile`  | `api-client`, `crypto`, `data`, `i18n`, `sync`, `types`                    |
| `apps/api-e2e` | `api` (for router types), `crypto`, `sync`, `types`                        |

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

| Tier                  | Scope                                                  | Algorithm                                       | Key holder                                       |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------ |
| T1 — User content     | Member profiles, journal entries, front logs, messages | XChaCha20-Poly1305 (libsodium)                  | Client only; server sees ciphertext              |
| T2 — Operational data | Email addresses, webhook URLs                          | AES-256-GCM (BLAKE2b hash preserved for lookup) | Server; encrypted at rest, decrypted transiently |
| T3 — Infrastructure   | Push tokens, session metadata                          | Plaintext (TLS in transit)                      | Server; no application-level encryption          |

Per-bucket symmetric keys are derived client-side. The server never holds T1 key material.

---

## 4. Key Architecture Decisions

| Pattern             | Decision                                                      | ADR                                                                              |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| License             | AGPL-3.0 — copyleft to protect community data                 | [adr/001-agpl-3-license.md](adr/001-agpl-3-license.md)                           |
| Frontend framework  | React Native via Expo — single codebase for iOS, Android, Web | [adr/002-frontend-framework.md](adr/002-frontend-framework.md)                   |
| API framework       | Hono on Bun — fast, edge-compatible, supports Bun native APIs | [adr/003-api-framework.md](adr/003-api-framework.md)                             |
| Database            | PostgreSQL (hosted) + SQLite/SQLCipher (client + self-hosted) | [adr/004-database.md](adr/004-database.md)                                       |
| Offline sync        | CRDT-based encrypted sync; server relays opaque ciphertext    | [adr/005-offline-sync.md](adr/005-offline-sync.md)                               |
| Encryption          | libsodium — XChaCha20-Poly1305, X25519, Argon2id              | [adr/006-encryption.md](adr/006-encryption.md)                                   |
| Real-time           | WebSocket + SSE via tRPC subscriptions                        | [adr/007-realtime.md](adr/007-realtime.md)                                       |
| Runtime             | Bun — faster cold start, native SQLite, built-in test runner  | [adr/008-runtime.md](adr/008-runtime.md)                                         |
| Blob storage        | S3-compatible (MinIO self-hosted); pre-signed URLs            | [adr/009-blob-media-storage.md](adr/009-blob-media-storage.md)                   |
| Background jobs     | BullMQ-compatible queue on Valkey                             | [adr/010-background-jobs.md](adr/010-background-jobs.md)                         |
| Key recovery        | Recovery code derivation via Argon2id, sharded backup         | [adr/011-key-recovery.md](adr/011-key-recovery.md)                               |
| Self-hosted tiers   | Minimal (single binary) vs Full (Docker Compose)              | [adr/012-self-hosted-tiers.md](adr/012-self-hosted-tiers.md)                     |
| Encryption boundary | T1/T2/T3 classification; fail-closed on unmapped data         | [adr/018-encryption-at-rest-boundary.md](adr/018-encryption-at-rest-boundary.md) |
| RLS denormalization | system_id/account_id columns on every table for RLS           | [adr/020-rls-denormalization.md](adr/020-rls-denormalization.md)                 |
| Email encryption    | Server-side AES-256-GCM; BLAKE2b hash for lookup              | [adr/029-server-side-encrypted-email.md](adr/029-server-side-encrypted-email.md) |
| Web storage backend | OPFS+wa-sqlite preferred, IndexedDB fallback; auto-detected   | [adr/031-web-storage-backend.md](adr/031-web-storage-backend.md)                 |
| tRPC parity         | `pnpm trpc:parity` enforces REST+tRPC coverage on every PR    | [adr/032-trpc-parity-enforcement.md](adr/032-trpc-parity-enforcement.md)         |

---

## 5. Security Model

### Zero-Knowledge Server

The server stores only T1 ciphertext. It cannot read member profiles, journal entries, front logs, or messages. Key material is never transmitted to the server.

Per-bucket symmetric keys are generated client-side and exchanged between devices via encrypted key bundles (X25519 ECDH). Key rotation is lazy: triggered on device removal or compromise, not on every write.

### Fail-Closed Privacy

Privacy bucket membership is evaluated client-side using intersection logic. If bucket data is unavailable, corrupted, or unmapped, access defaults to maximum restriction — the system's data is never accidentally exposed. This principle extends to the API: missing or erroneous privacy context is treated as "deny".

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

**M8 — Client app foundation**: The mobile/web UI consumes the API. Building the client after the API is stable prevents constant frontend rework caused by breaking schema changes. Import/export, PluralKit bridge, and API key management are client-side features bundled here. In practice, M8 epics are developed in parallel with M2–M7 — each API feature ships with its corresponding UI.

**M9–M10 — UI design → buildout**: Visual design system established before the buildout phase; avoids retrofitting accessibility and design tokens.

**M11 — Data interpolation**: Wire screens to tRPC hooks and local SQLite; the full offline-first experience becomes testable end-to-end.

**M12 — Ancillary features**: Vertical slices (timers, custom fields, innerworld, etc.) added after the core loop is proven stable.

**M13–M14 — Self-hosted → polish**: Self-hosted mode requires a complete, stable feature set before the SQLite adapter is meaningful. Polish is the final hardening pass before public launch.
