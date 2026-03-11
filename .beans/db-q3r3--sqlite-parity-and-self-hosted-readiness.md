---
# db-q3r3
title: SQLite parity and self-hosted readiness
status: todo
type: feature
created_at: 2026-03-11T19:39:34Z
updated_at: 2026-03-11T19:39:34Z
parent: db-2je4
---

SQLite must be a first-class citizen for the self-hosted tier. Close all gaps between PG and SQLite schemas.

## Consolidates

db-5f9e, db-gxrb, db-hbkq, db-sbqe

## Tasks

- [ ] Close SQLite CHECK constraint and index gaps vs PG (db-5f9e)
- [ ] SQLite jobs table: implement full ADR 010 (db-gxrb)
- [ ] Fix import_jobs SQLite CHECK constraint NULL guard (db-hbkq)
- [ ] Document or enforce SQLite single-tenant isolation (db-sbqe)
