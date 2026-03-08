# Pluralscape

A community-driven, open-source plurality management platform.

Pluralscape helps plural systems (DID, OSDD, and beyond) manage identity tracking, fronting logs, internal communication, and privacy-controlled external sharing across web, iOS, and Android.

## Status

**Early development.** The project is in its planning and setup phase.

## Values

Privacy-first. Accessibility-first. Community-driven. No paywalled features. No telemetry without opt-in. No gatekeeping.

Read the full [Values](VALUES.md).

## Tech Stack

| Layer        | Technology                                      | Decision Record                               |
| ------------ | ----------------------------------------------- | --------------------------------------------- |
| Frontend     | Expo (React Native) + TypeScript                | [ADR 002](docs/adr/002-frontend-framework.md) |
| API          | Hono on Bun + tRPC (internal) + REST (public)   | [ADR 003](docs/adr/003-api-framework.md)      |
| Database     | PostgreSQL + Drizzle ORM / SQLite (self-hosted) | [ADR 004](docs/adr/004-database.md)           |
| Offline Sync | Custom CRDT (Automerge)                         | [ADR 005](docs/adr/005-offline-sync.md)       |
| Encryption   | libsodium (E2E, zero-knowledge server)          | [ADR 006](docs/adr/006-encryption.md)         |
| Real-Time    | WebSockets + SSE + Valkey                       | [ADR 007](docs/adr/007-realtime.md)           |
| Runtime      | Bun (Node.js fallback)                          | [ADR 008](docs/adr/008-runtime.md)            |

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
| [Bun](https://github.com/oven-sh/bun)                      | JavaScript/TypeScript runtime                          | MIT          |

## Architecture Decision Records

Major technical decisions are documented as ADRs in [`docs/adr/`](docs/adr/). Each ADR captures the context, decision, consequences, and license implications. See the [ADR template](docs/adr/000-template.md) for the format.

## License

[AGPL-3.0](LICENSE) — ensuring this project and all derivatives remain open source.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).
