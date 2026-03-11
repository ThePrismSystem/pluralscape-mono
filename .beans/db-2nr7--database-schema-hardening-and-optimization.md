---
# db-2nr7
title: Database schema hardening and optimization
status: todo
type: epic
created_at: 2026-03-11T19:40:12Z
updated_at: 2026-03-11T19:40:12Z
parent: ps-vtws
---

Deferred DB work — performance indexes, non-critical encryption, evaluations, sync queue fixes, and sizing. Not blocking M2 API development but should be completed within M1 before broader release.

## Categories

### Performance indexes (10)

- db-4n2x: Partitioning strategy for messages table
- db-9mdk: Replace low-cardinality boolean indexes with composites
- db-337v: Partial index on fronting_sessions for active fronters
- db-0xcq: Composite (system_id, archived) index on members
- db-cqyx: Composite (system_id, purpose) index on blob_metadata
- db-koeg: Covering index on bucket_content_tags for privacy hot path
- db-gx66: Index on friend_bucket_assignments.bucket_id
- db-l1qp: Timestamp index on audit_log for range purges
- db-ahn1: Partitioning and retention for audit_log
- db-2qv7: Right-size varchar(255) ID columns

### Non-critical encryption (5)

- db-npmf: Encrypt api_keys metadata fields
- db-bua4: Encrypt sessions.deviceInfo
- db-yrwc: Encrypt or hash wikiPages.slug
- db-jpym: Encrypt webhookConfigs.url and eventTypes
- db-kj3j: Implement encryption-at-rest at DB layer

### Evaluations and documentation (7)

- db-qj1d: Evaluate versioned() OCC impact on high-write tables
- db-oxge: Evaluate importJobs.source metadata leakage
- db-cvfk: Evaluate blobMetadata plaintext metadata leakage
- db-dq3f: Evaluate accounts.passwordHash security posture
- db-7xrs: Evaluate dual indexes on lifecycleEvents
- db-d8h1: Add size limit to importJobs.errorLog JSONB
- db-uomh: Add explicit mapper for audit_log timestamp field

### Sync queue fixes (3)

- db-jc10: Fix syncQueue UUID v4 ordering issue
- db-dfzf: Add cleanup strategy for sync_queue and fix UUID ordering
- db-0l3g: Add size constraint to sync_documents.automerge_heads

### PG search (1)

- db-qmse: Implement PG full-text search

### Misc (2)

- db-4lpt: Add TTL cleanup for webhook_deliveries terminal states
- db-459d: Add missing Argon2id KDF salt column to accounts
