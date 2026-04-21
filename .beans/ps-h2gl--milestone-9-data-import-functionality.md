---
# ps-h2gl
title: "Milestone 9: Data Import Functionality"
status: completed
type: milestone
priority: normal
created_at: 2026-03-31T23:10:26Z
updated_at: 2026-04-21T05:42:19Z
blocked_by:
  - ps-7j8n
---

Simply Plural and PluralKit data import engines, shared import-core orchestration, import API infrastructure, mobile glue, E2E test suites.

## Summary of Changes

Pulled data import forward from old M12 (Ancillary Features) as a standalone milestone. Import is data-layer work — establishing the full data surface (including imported SP and PK data) before UI/UX design begins.

### Completed Epics

- Simply Plural import (`packages/import-sp`) — 15 collection mappers (14 with full API support), file and API source modes, Zod validation, encrypted payload alignment, notes support
- PluralKit import (`packages/import-pk`) — member, group, fronting session, group membership mapping from PK JSON exports
- Import-core extraction (`packages/import-core`) — shared orchestration engine with Persister interface, checkpoint resume, entity ref tracking (ADR 034)
- Import API infrastructure — REST + tRPC routes, batch entity-ref operations, mobile glue (17 entity persisters, import hooks, avatar fetcher)
- SP seed script (`scripts/sp-seed`) + PK seed script (`scripts/pk-seed`) + E2E test infrastructure

### Key PRs

- #401: SP import API foundation
- #402: SP import engine
- #406: SP import engine + mobile glue
- #408: SP import audit + E2E infrastructure
- #409: SP import audit fixes + real-data bugs
- #410: SP import API notes support
- #412: PluralKit import + shared E2E infrastructure
- #421: PK import test revamp + zero-duration session fix

### ADRs Added

- ADR 033: PluralKit API client library selection
- ADR 034: Import-core extraction

## Summary of Changes

Milestone 9 delivered the full data-import surface plus post-audit hardening:

### Imports (ps-nrg4, ps-dvxb, ps-0w7l, ps-n0tq, ps-0enb, ps-hlq3, ps-86ya, ps-v7el)

- Simply Plural import: file + API source modes, 15 collections, encrypted payload alignment, notes support.
- PluralKit import: members, groups, fronting sessions, privacy-bucket synthesis, IPv6 loopback support.
- Shared `packages/import-core` orchestration engine with checkpoint resume and pluggable Persister interface (ADR 034).
- Mobile glue with 17 entity persisters and E2E infrastructure using deterministic seed scripts.
- Mapped types routed through `@pluralscape/validation` schemas.

### Zero-Knowledge compliance (ps-f5mh, crypto-w0fu, crypto-cpir)

- Migrated all master-key operations to the client; server persists only encrypted master-key blobs and the auth-key hash.
- Constant-time comparisons in crypto primitives; zero-key-material-after-use in rotation-worker.
- NIST/RFC test vectors added for X25519, Ed25519, Argon2, BLAKE2b, XChaCha20-Poly1305.

### Audit remediation (ps-ai5y, ps-g937, ps-9ujv, ps-up0u, ps-0enb, ps-tgk6, ps-tdj8; per-package epics api-v8zu, db-bry7, mobile-e3l7, sync-me6c)

- Seven `chore(audit-m9)` PRs covering api, crypto, db, mobile, sync, queue+imports (#524, #525, #526, #529, #530, #531).
- API: MIME validation, S3 size enforcement, session error codes, per-endpoint API-key scope enforcement.
- DB: sync table RLS, friend connection RLS, device token hashing, partition sanitation.
- Mobile: SQLite encryption, hooks ordering.
- Sync: auth key binding, snapshot signatures, document authorization, materializer scoped queries.
- Crypto: streaming improvements, CryptoError base class.

### CI / Security / Deps

- pnpm catalog adoption; Renovate batch updates; Terraform Google v7.
- CodeQL v4 alignment; email ReDoS fix; HMAC-SHA256 API-key hashing (PR #395).
- Coverage threshold raised to 89% across lines/functions/branches/statements.

### Infra

- GCP billing kill-switch Terraform module (PR #504).
- OPFS wa-sqlite driver (mobile-shr0 phases 1-2, PRs #459, #460, #461).
- Async `SqliteDriver` contract; parameterised queries in OPFS driver.

### Documentation

- Comprehensive docs refresh (tracking bean ps-w3j9) brought README, CHANGELOG, architecture, milestones, features, api-specification, database-schema, OpenAPI spec, tRPC guide, consumer guides, CONTRIBUTING, ADRs, and all 15 package READMEs into alignment with the shipped code.
