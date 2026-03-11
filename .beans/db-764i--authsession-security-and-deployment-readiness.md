---
# db-764i
title: Auth/session security and deployment readiness
status: todo
type: feature
created_at: 2026-03-11T19:39:36Z
updated_at: 2026-03-11T19:39:36Z
parent: db-2je4
---

Without migrations the schema can't deploy. Without session expiry and key revocation, auth is incomplete.

## Consolidates

db-zyf7, db-uadp, db-ncyx, db-4o4t, db-qdla

## Tasks

- [ ] Generate and commit DB migrations — both PG and SQLite (db-zyf7)
- [ ] Add migration-presence CI check (db-uadp)
- [ ] Add expiresAt to sessions table (db-ncyx)
- [ ] Add revocation timestamp to recoveryKeys (db-4o4t)
- [ ] Add encryptedKeyMaterial to deviceTransferRequests (db-qdla)
