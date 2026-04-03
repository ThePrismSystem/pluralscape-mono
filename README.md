<p align="center">
  <img src="ui-design/logo/pluralscape-wordmark-dark.svg" alt="Pluralscape" width="480">
</p>

<p align="center">A community-driven, open-source plurality management platform.</p>

Pluralscape helps plural systems (DID, OSDD, and beyond) manage identity tracking, fronting logs, internal communication, and privacy-controlled external sharing across web, iOS, and Android.

## Status

**Active development — Milestones 0-7 complete, Milestone 8 (App Foundation & Data Layer) next.**

Milestones 0 (infrastructure), 1 (data layer), 2 (API Core), 3 (Sync and Real-Time), 4 (Fronting Engine), 5 (Communication), 6 (Privacy and Social), and 7 (Data Portability) are complete. The full REST API is documented in a comprehensive [OpenAPI 3.1 specification](docs/openapi/openapi.yaml) ([bundled single-file](docs/openapi.yaml)) covering 304 operations across 31 route domains. The internal tRPC layer provides end-to-end type-safe access to the same service layer for the Expo mobile client (see [tRPC guide](docs/trpc-guide.md) and [ADR 032](docs/adr/032-trpc-parity-enforcement.md)).

Milestone 7 delivered: email notifications (Resend + SMTP adapters with security notification templates), server-side encrypted email storage (ADR 029), webhook enhancements (secret rotation, test/ping endpoint, payload encryption), webhook event dispatch for identity and friend events, API feature completeness (closing audit gaps across account management, friends, API keys, system operations, structure entities, communication, and infrastructure), tRPC parity (35 routers mirroring every REST endpoint with CI-enforced consistency), API consumer guide, multiple audit rounds, and comprehensive E2E test expansion. See the [CHANGELOG](CHANGELOG.md) for details, the [milestone roadmap](docs/planning/milestones.md) for the full plan, and the [feature specification](docs/planning/features.md) for scope.

## Test Suite

Unit and integration tests run via Vitest; E2E tests via Playwright (`apps/api-e2e`). Coverage is enforced in CI at 85% minimum (lines, functions, branches, statements).

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:coverage     # Tests with coverage report
pnpm test:e2e          # E2E tests (Playwright)
```

### Current Coverage

| Metric     | Coverage |
| ---------- | -------- |
| Statements | 95.54%   |
| Branches   | 87.37%   |
| Functions  | 96.22%   |
| Lines      | 96.06%   |

E2E suite: 314 tests across 69 spec files covering auth, CRUD, fronting, sync, webhooks, timers, real-time notifications, chat, boards, notes, polls, acknowledgements, privacy buckets, friends, dashboards, notifications, report export, blobs, custom fields, relationships, innerworld, API keys, check-in records, lifecycle events, notification configs, and tRPC smoke tests. Run `pnpm test:coverage` for up-to-date numbers.

## Values

Privacy-first. Accessibility-first. Community-driven. No paywalled features. No telemetry without opt-in. No gatekeeping. No diagnosis required.

Read the full [Values](VALUES.md).

## Repository Structure

This is a **pnpm monorepo** orchestrated by [Turborepo](https://turbo.build).

```
apps/
  api/             Hono on Bun — tRPC (internal) + REST (public)
  api-e2e/         E2E test suite (Playwright)
  mobile/          Expo (React Native) — web, iOS, Android

packages/
  types/           Shared domain types, Zod validators, branded IDs, API constants
  crypto/          E2E encryption — libsodium (WASM + React Native adapters)
  db/              Drizzle ORM schemas — PostgreSQL + SQLite dual-dialect
  sync/            CRDT sync protocol — Automerge
  api-client/      tRPC + TanStack Query client bindings
  email/           Transactional email — Resend + SMTP adapters, templates
  i18n/            Internationalization — locale formatting, nomenclature
  queue/           Background job queue — SQLite-backed with retry/DLQ
  rotation-worker/ Key rotation worker — processes bucket key rotation chunks
  storage/         Blob storage — S3 + filesystem adapters, quota management
  validation/      Shared Zod validation schemas with contract tests

tooling/
  eslint-config/   Shared ESLint configuration
  prettier-config/ Shared Prettier configuration
  test-utils/      Shared test utilities and factories
  tsconfig/        Shared TypeScript configs (base.json, node.json)

ui-design/
  logo/            Brand assets (SVG icon, wordmark)
  BRANDING.md      Brand guidelines — colors, typography, components

docs/
  openapi/         OpenAPI 3.1 spec (multi-file source, Redocly CLI)
  openapi.yaml     Bundled single-file OpenAPI spec (generated)
  adr/             Architecture Decision Records (33 accepted)
  audits/          Codebase audit reports
  planning/        Specifications, milestones, feature planning
  future-features/ Unscheduled feature design documents
```

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
| Media        | S3-compatible (MinIO for self-hosted)           | [ADR 009](docs/adr/009-blob-media-storage.md) |
| Job Queue    | BullMQ (Valkey) / SQLite (self-hosted fallback) | [ADR 010](docs/adr/010-background-jobs.md)    |

All dependencies verified AGPL-3.0 compatible — see [license audit](docs/audits/001-license-compatibility.md). Architecture decisions documented in [33 ADRs](docs/adr/).

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
| [Resend](https://github.com/resendlabs/resend-node)        | Transactional email API (hosted deployments)           | MIT          |
| [Nodemailer](https://github.com/nodemailer/nodemailer)     | SMTP email delivery (self-hosted deployments)          | MIT-0        |
| [MinIO](https://github.com/minio/minio)                    | S3-compatible object storage (self-hosted media)       | AGPL-3.0     |
| [Bun](https://github.com/oven-sh/bun)                      | JavaScript/TypeScript runtime                          | MIT          |

## Features

Pluralscape targets full feature parity with Simply Plural, plus new capabilities. Key feature areas:

- **Identity management** — member profiles (pronouns, avatars, colors, custom fields, tags, saturation levels), groups/folders, archival, custom fronts
- **Fronting and analytics** — front logging with co-fronting as parallel timelines, historical editing, timeline visualization, analytics dashboards, automated check-in timers
- **Communication** — proxy-based system chat, board messages, private notes, polls with consensus analytics, mandatory acknowledgement routing
- **Privacy and social** — intersection-based privacy buckets (fail-closed), friend network with read-only dashboards, granular per-friend visibility, push notifications
- **Journaling** — polymorphic authorship (member, co-authored, or system-level), privacy bucket integration
- **Data portability** — Simply Plural and PluralKit import, full data export, PluralKit bridge, public REST API
- **Self-hosted** — two-tier deployment: minimal single binary for personal use, full Docker Compose for feature parity
- **Encryption** — end-to-end encrypted with XChaCha20-Poly1305, X25519 key exchange, Argon2id password hashing. Server is zero-knowledge
- **Offline-first** — local SQLite is source of truth, Automerge CRDT sync, cryptographic confirmation before deletion of local data

See the complete [feature specification](docs/planning/features.md).

## Development

### Prerequisites

- [Bun](https://bun.sh) (runtime)
- [pnpm](https://pnpm.io) 10.x (package manager)
- [Node.js](https://nodejs.org) 18+ (for tooling compatibility)
- PostgreSQL 15+ (for integration tests)

### Getting Started

```bash
pnpm install           # Install all dependencies
pnpm build             # Build all packages
pnpm dev               # Start all dev servers (turbo)
```

### Available Scripts

```bash
pnpm dev               # Start all dev servers
pnpm build             # Build all packages
pnpm typecheck         # TypeScript type-checking (all packages)
pnpm lint              # Lint all packages (zero warnings enforced)
pnpm lint:fix          # Lint and auto-fix
pnpm format            # Check formatting (Prettier)
pnpm format:fix        # Auto-format
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:coverage     # Tests with coverage report
pnpm test:e2e          # E2E tests (Playwright)
pnpm clean             # Clean build artifacts
pnpm roadmap           # Generate docs/roadmap.md from beans
pnpm codeql            # Run CodeQL security analysis
pnpm openapi:lint      # Validate OpenAPI spec
pnpm openapi:bundle    # Bundle multi-file spec into docs/openapi.yaml
```

### Code Quality

Strict TypeScript and ESLint rules are enforced with zero warnings tolerance (`--max-warnings 0`). Key rules:

- No `any`, `@ts-ignore`, non-null assertions (`!`), or `var`
- No floating promises, swallowed errors, or `console.log` in production code
- Explicit return types on exported functions
- Exhaustive `switch` on union types
- All interactive UI elements must have accessibility props

### Methodology

This project follows **Test-Driven Development** (TDD). All new code is written test-first: write a failing test, make it pass, refactor. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full TDD guidelines.

## Work Tracking

This project uses [**beans**](https://github.com/btvnlue/beans) for issue tracking — beans are markdown files stored in `.beans/` and committed with code. See [docs/work-tracking.md](docs/work-tracking.md) for conventions.

Issue types: `milestone` > `epic` > `feature` / `task` / `bug`
Domain prefixes: `ps-`, `api-`, `mobile-`, `db-`, `crypto-`, `sync-`, `types-`, `client-`, `infra-`

## Architecture Decision Records

Major technical decisions are documented as ADRs in [`docs/adr/`](docs/adr/). 33 accepted ADRs cover the full stack from licensing through email provider selection. See the [ADR template](docs/adr/000-template.md) for the format.

## License

[AGPL-3.0](LICENSE) — ensuring this project and all derivatives remain open source.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Vulnerabilities are handled through GitHub's private advisory system with a 48-hour acknowledgement SLA.
