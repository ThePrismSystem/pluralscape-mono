---
# api-qwrq
title: Resolve lifecycle event type-specific validation design
status: completed
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T08:12:39Z
parent: api-i2pw
---

Bean api-dwou describes per-event-type Zod schemas but all type-specific data is in encryptedData (E2E encrypted). Server cannot validate. Design decision needed: add plaintext reference IDs or scope to client-side validation. Ref: audit B-1.

## Decision: Option B\n\nImplemented plaintext reference fields (plaintextMetadata JSONB column) for server-side validation and query optimization. Per-event-type discriminated metadata schemas validate memberIds, structureIds, entityIds, and regionIds. Referential integrity is soft-checked via validation only (no FK constraints on the JSONB fields).

## Summary of Changes\n\nAdded plaintextMetadata JSONB column to lifecycle_events (PG + SQLite). Created per-event-type Zod schemas for metadata validation. Updated CreateLifecycleEventBodySchema and createLifecycleEvent service to validate and persist metadata.
