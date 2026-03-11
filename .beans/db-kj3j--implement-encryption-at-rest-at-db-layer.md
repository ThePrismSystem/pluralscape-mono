---
# db-kj3j
title: Implement encryption-at-rest at DB layer
status: todo
type: task
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

SECURITY.md says all stored data is encrypted at rest. ADR 006 requires SQLCipher for local DB; ADR 004 calls out pgcrypto. DB uses better-sqlite3 (not SQLCipher). ENABLE_PGCRYPTO constant exists but migrations are empty. Document implementation boundary or wire SQLCipher/pgcrypto. Ref: audit H1
