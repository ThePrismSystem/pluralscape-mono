# ADR 012: Self-Hosted Deployment Tiers

## Status

Accepted

## Context

Pluralscape offers self-hosting to give users full data sovereignty — a core value driven by the SP shutdown and community distrust of centralized services. However, the full hosted stack requires PostgreSQL, Valkey, S3-compatible storage, and push notification providers. Requiring all of these for self-hosting creates a prohibitively high barrier to entry.

The self-hosted deployment must:

- Be accessible to non-technical users (download and run)
- Not require cloud services or complex infrastructure
- Clearly communicate what features are available at each level
- Scale from single-user personal use to small community instances

Evaluated: single-tier (full stack required), single-tier (everything embedded), two-tier (minimal + full).

## Decision

**Two deployment tiers** with a clear capability matrix.

### Minimal tier: Single binary

A single Bun-compiled binary with no external dependencies. Download, run, use.

| Component          | Implementation                                                    |
| ------------------ | ----------------------------------------------------------------- |
| Runtime            | Bun single binary (`bun build --compile`)                         |
| Database           | Embedded SQLite via Drizzle                                       |
| Blob storage       | Local filesystem (configurable directory)                         |
| Job queue          | In-process SQLite-backed queue (ADR 010)                          |
| Real-time          | HTTP polling (no WebSocket, no SSE)                               |
| Push notifications | Not available                                                     |
| Setup              | First-run wizard (creates admin account, configures storage path) |

**Target users**: Personal use, single system, small household. Users who want data sovereignty without infrastructure overhead.

### Full tier: Docker Compose

A preconfigured Docker Compose file with all services. One command to start.

| Component          | Implementation                                                     |
| ------------------ | ------------------------------------------------------------------ |
| Runtime            | Bun in container                                                   |
| Database           | PostgreSQL container                                               |
| Blob storage       | MinIO container (S3-compatible)                                    |
| Job queue          | BullMQ backed by Valkey container (ADR 010)                        |
| Real-time          | WebSockets + SSE, Valkey pub/sub (ADR 007)                         |
| Push notifications | Available (requires FCM/APNs configuration)                        |
| Setup              | First-run wizard + environment variables for service configuration |

**Target users**: Community instances, self-hosters comfortable with Docker, users who want feature parity with the hosted service.

### Capability matrix

| Feature                                        | Minimal             | Full                          | Hosted         |
| ---------------------------------------------- | ------------------- | ----------------------------- | -------------- |
| Core features (members, fronting, chat, notes) | Yes                 | Yes                           | Yes            |
| E2E encryption                                 | Yes                 | Yes                           | Yes            |
| Offline-first / local SQLite                   | Yes                 | Yes                           | Yes            |
| Multi-device sync                              | Polling             | Real-time                     | Real-time      |
| Friend network / privacy buckets               | Yes                 | Yes                           | Yes            |
| Push notifications to friends                  | No                  | Yes (with config)             | Yes            |
| Background jobs (imports, reports)             | In-process          | BullMQ workers                | BullMQ workers |
| Media storage                                  | Local filesystem    | MinIO (S3)                    | S3 provider    |
| Horizontal scaling                             | No                  | Yes (multiple API containers) | Yes            |
| Backups                                        | User responsibility | User responsibility           | Managed        |

### Upgrade path

Moving from minimal to full tier:

1. Export SQLite database
2. Import into PostgreSQL (migration tool provided)
3. Move blob directory contents to MinIO (migration tool provided)
4. Switch to Docker Compose configuration
5. Existing encryption keys and user data are preserved (no re-encryption needed)

### What is NOT self-hostable

- App store distribution (users install the same Expo app, pointed at their own server URL)
- Crowdin translation management (community translations flow through the main project)

## Consequences

- Two deployment targets double the integration testing surface — CI must test both tiers
- Minimal tier has meaningful feature gaps (no push, no real-time, no horizontal scaling) — these must be clearly communicated in documentation, not discovered by surprise
- The upgrade path (SQLite → PostgreSQL, filesystem → MinIO) requires migration tooling — this is non-trivial engineering work
- Docker Compose simplifies the full tier but still requires Docker knowledge — truly non-technical users will use the minimal tier or the hosted service
- Push notifications require Apple/Google developer accounts for FCM/APNs — even the full self-hosted tier cannot provide push without this external dependency

### License

No new dependencies. MinIO (AGPL-3.0), Valkey (BSD 3-Clause), BullMQ (MIT) — all compatible.
