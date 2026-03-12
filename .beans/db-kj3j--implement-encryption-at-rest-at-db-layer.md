---
# db-kj3j
title: Implement encryption-at-rest at DB layer
status: completed
type: task
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T11:24:25Z
parent: db-2nr7
---

SECURITY.md says all stored data is encrypted at rest. ADR 006 requires SQLCipher for local DB; ADR 004 calls out pgcrypto. DB uses better-sqlite3 (not SQLCipher). ENABLE_PGCRYPTO constant exists but migrations are empty. Document implementation boundary or wire SQLCipher/pgcrypto. Ref: audit H1

## Summary of Changes

- Added pgcrypto extension to PG migration (CREATE EXTENSION IF NOT EXISTS pgcrypto)
- Created ADR 018 documenting the encryption-at-rest boundary (E2E vs infrastructure-level vs transit)
- Updated SECURITY.md to clarify E2E encryption, at-rest encryption, and transit encryption as separate layers
- Updated dialect-capabilities.md to note pgcrypto is now enabled in migration
- Created follow-up bean db-l49z for SQLCipher migration
