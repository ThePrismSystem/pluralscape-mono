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
- Architecture Decision Records:
  - ADR 001: AGPL-3.0 license
  - ADR 002: Frontend framework (Expo / React Native)
  - ADR 003: API framework (Hono + tRPC + REST on Bun)
  - ADR 004: Database (PostgreSQL + Drizzle ORM / SQLite)
  - ADR 005: Offline-first sync (custom CRDT with Automerge)
  - ADR 006: Encryption (libsodium, Etebase-inspired protocol)
  - ADR 007: Real-time (WebSockets + SSE + Valkey)
  - ADR 008: Runtime (Bun with Node.js fallback)
- Encryption architecture research (`docs/planning/encryption-research.md`)
- License compatibility audit (`docs/audits/001-license-compatibility.md`)
