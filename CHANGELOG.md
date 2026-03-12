# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Core values (`VALUES.md`)
- AGPL-3.0 license
- Community files: Code of Conduct, Contributing guide, Security policy
- PR template with review checklist
- `.gitignore`, `.editorconfig`
- Architecture Decision Records (18 total):
  - ADR 001: AGPL-3.0 license
  - ADR 002: Frontend framework (Expo / React Native)
  - ADR 003: API framework (Hono + tRPC + REST on Bun)
  - ADR 004: Database (PostgreSQL + Drizzle ORM / SQLite)
  - ADR 005: Offline-first sync (custom CRDT with Automerge)
  - ADR 006: Encryption (libsodium, Etebase-inspired protocol)
  - ADR 007: Real-time (WebSockets + SSE + Valkey)
  - ADR 008: Runtime (Bun with Node.js fallback)
  - ADR 009: Blob/media storage (S3-compatible, MinIO for self-hosted)
  - ADR 010: Background job architecture (BullMQ / SQLite fallback)
  - ADR 011: Key lifecycle and recovery (recovery key, multi-device transfer)
  - ADR 012: Self-hosted deployment tiers (minimal vs full)
  - ADR 013: API authentication with E2E encryption (hybrid model)
  - ADR 014: Lazy key rotation for privacy buckets
  - ADR 015: Plaintext push tokens (server-side only)
  - ADR 016: Hash-based message table partitioning
  - ADR 017: Time-based audit log partitioning
  - ADR 018: Encryption-at-rest DB layer boundary
- Encryption architecture research (`docs/planning/encryption-research.md`)
- Audits:
  - License compatibility audit (`docs/audits/001-license-compatibility.md`)
  - Hosting cost estimate (`docs/audits/002-hosting-cost-estimate.md`)
  - Database schema audit (`docs/audits/003-database-schema-audit.md`)
- `@pluralscape/types` package — 30+ domain type modules with Zod validators, branded IDs, and runtime helpers covering identity, fronting, communication, privacy, encryption tiers, sync, jobs, webhooks, search, i18n, and more
- `@pluralscape/db` package — Drizzle ORM schema for PostgreSQL and SQLite dual-dialect with 40+ tables, row-level security, common views, query helpers, and encryption contract hardening
- `@pluralscape/crypto` package — libsodium cross-platform bindings (WASM + React Native), master key derivation, symmetric encryption/decryption, identity keypair generation, and signature operations
- `@pluralscape/sync` package — encrypted CRDT relay proof-of-concept with Automerge, sync session management, and document topology design
- Test framework — Vitest workspace configuration with coverage enforcement, test factories, and shared utilities (2,338 tests across 132 files)
- Database schema hardening — 29 optimization tasks: performance indexes (composites, partials, covering), non-critical encryption (API keys, sessions, webhooks, wiki slugs), sync queue fixes, full-text search, and varchar right-sizing
- Work tracking with beans (CLI-based issue tracker committed alongside code)
- Roadmap generation from beans (`pnpm roadmap`)
- CodeQL security analysis integration (`pnpm codeql`)
