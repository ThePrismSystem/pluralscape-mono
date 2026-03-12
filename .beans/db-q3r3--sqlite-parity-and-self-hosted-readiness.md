---
# db-q3r3
title: SQLite parity and self-hosted readiness
status: completed
type: feature
priority: normal
created_at: 2026-03-11T19:39:34Z
updated_at: 2026-03-12T04:12:35Z
parent: db-2je4
---

SQLite must be a first-class citizen for the self-hosted tier. Close all gaps between PG and SQLite schemas.

## Consolidates

db-5f9e, db-gxrb, db-hbkq, db-sbqe

## Tasks

- [x] Close SQLite CHECK constraint and index gaps vs PG (db-5f9e)
- [x] SQLite jobs table: implement full ADR 010 (db-gxrb)
- [x] Fix import_jobs SQLite CHECK constraint NULL guard (db-hbkq)
- [x] Document or enforce SQLite single-tenant isolation (db-sbqe)

## Summary of Changes

All four sub-beans completed. SQLite schema now has full CHECK constraint and index parity with PostgreSQL. Jobs table implements ADR 010 requirements (DLQ, heartbeat, scheduling, priority). Single-tenant isolation documented as architectural boundary.
