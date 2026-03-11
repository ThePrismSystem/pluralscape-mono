---
# db-xrbt
title: Add missing ADR 014 key-rotation ledger tables
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T06:42:33Z
parent: db-2je4
---

bucket_key_rotations and bucket_rotation_items tables from ADR 014 do not exist in PG or SQLite. Job type bucket-key-rotation is accepted in ADR 010 but has no persistence. Also add kdfSalt column to accounts (ADR 006 requires Argon2id salt for MasterKey derivation). Ref: audit CR4, CR8

## Implementation Plan

- [x] Create key-rotation types in packages/types
- [x] Add ROTATION_STATES and ROTATION_ITEM_STATUSES enums
- [x] Create PG key-rotation schema with bucket_key_rotations and bucket_rotation_items
- [x] Create SQLite key-rotation schema
- [x] Add kdfSalt to accounts (PG + SQLite)
- [x] Export from index files
- [x] Update test helpers DDL
- [x] Write integration tests
- [x] Verify typecheck, lint, tests pass

## Summary of Changes

Added ADR 014 key-rotation ledger tables (`bucket_key_rotations` and `bucket_rotation_items`) to both PG and SQLite schemas with full CHECK constraints, FK cascades, and indexes. Added `kdfSalt` nullable column to accounts table. Created `RotationState` and `RotationItemStatus` types in types package. Added 20 integration tests covering round-trip, cascades, CHECK constraint enforcement, and nullable defaults.
