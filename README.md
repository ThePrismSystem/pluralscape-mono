# Pluralscape

A community-driven, open-source plurality management platform.

Pluralscape helps plural systems (DID, OSDD, and beyond) manage identity tracking, fronting logs, internal communication, and privacy-controlled external sharing across web, iOS, and Android.

## Status

**Early development.** The project is in its planning and setup phase.

## Values

Privacy-first. Accessibility-first. Community-driven. No paywalled features. No telemetry without opt-in. No gatekeeping.

Read the full [Values](VALUES.md).

## Tech Stack

| Layer        | Technology                                      | Decision Record                                |
| ------------ | ----------------------------------------------- | ---------------------------------------------- |
| Frontend     | Expo (React Native) + TypeScript                | [ADR 002](docs/adr/002-frontend-framework.md)  |
| API          | Hono on Bun + tRPC (internal) + REST (public)   | [ADR 003](docs/adr/003-api-framework.md)       |
| Database     | PostgreSQL + Drizzle ORM / SQLite (self-hosted) | [ADR 004](docs/adr/004-database.md)            |
| Offline Sync | Custom CRDT (Automerge)                         | [ADR 005](docs/adr/005-offline-sync.md)        |
| Encryption   | libsodium (E2E, zero-knowledge server)          | [ADR 006](docs/adr/006-encryption.md)          |
| Real-Time    | WebSockets + SSE + Valkey                       | [ADR 007](docs/adr/007-realtime.md)            |
| Runtime      | Bun (Node.js fallback)                          | [ADR 008](docs/adr/008-runtime.md)             |
| Media        | S3-compatible (MinIO for self-hosted)           | [ADR 009](docs/adr/009-blob-media-storage.md)  |
| Job Queue    | BullMQ (Valkey) / SQLite (self-hosted fallback) | [ADR 010](docs/adr/010-background-jobs.md)     |
| Key Recovery | Recovery key + multi-device transfer            | [ADR 011](docs/adr/011-key-recovery.md)        |
| Self-Hosted  | Minimal (single binary) / Full (Docker Compose) | [ADR 012](docs/adr/012-self-hosted-tiers.md)   |
| API Auth     | Hybrid metadata + crypto key model              | [ADR 013](docs/adr/013-api-auth-encryption.md) |

All dependencies verified AGPL-3.0 compatible — see [license audit](docs/audits/001-license-compatibility.md).

## Key Libraries

| Library                                                    | Purpose                                                | License      |
| ---------------------------------------------------------- | ------------------------------------------------------ | ------------ |
| [Expo](https://github.com/expo/expo)                       | Cross-platform app framework (web, iOS, Android)       | MIT          |
| [React Native](https://github.com/facebook/react-native)   | Native UI rendering                                    | MIT          |
| [Hono](https://github.com/honojs/hono)                     | Lightweight HTTP framework                             | MIT          |
| [tRPC](https://github.com/trpc/trpc)                       | End-to-end type-safe API layer                         | MIT          |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) | TypeScript-first SQL ORM (PostgreSQL + SQLite)         | Apache 2.0   |
| [Automerge](https://github.com/automerge/automerge)        | CRDT library for offline-first sync                    | MIT          |
| [libsodium](https://github.com/jedisct1/libsodium)         | Cryptographic primitives (XChaCha20, X25519, Argon2id) | ISC          |
| [SQLCipher](https://github.com/nicktimko/sqlcipher)        | Encrypted SQLite                                       | BSD 3-Clause |
| [Valkey](https://github.com/valkey-io/valkey)              | Pub/sub for real-time horizontal scaling               | BSD 3-Clause |
| [BullMQ](https://github.com/taskforcesh/bullmq)            | Background job queue (Valkey-backed)                   | MIT          |
| [MinIO](https://github.com/minio/minio)                    | S3-compatible object storage (self-hosted media)       | AGPL-3.0     |
| [Bun](https://github.com/oven-sh/bun)                      | JavaScript/TypeScript runtime                          | MIT          |
| [beans](https://github.com/btvnlue/beans)                  | Local-first issue tracker (stored as markdown)         | MIT          |

## Work Tracking

This project uses **beans** for issue tracking — beans are markdown files stored in `.beans/` and committed with code. See [docs/work-tracking.md](docs/work-tracking.md) for conventions.

## Architecture Decision Records

Major technical decisions are documented as ADRs in [`docs/adr/`](docs/adr/). Each ADR captures the context, decision, consequences, and license implications. See the [ADR template](docs/adr/000-template.md) for the format.

## License

[AGPL-3.0](LICENSE) — ensuring this project and all derivatives remain open source.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).
