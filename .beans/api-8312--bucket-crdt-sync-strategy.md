---
# api-8312
title: Bucket CRDT sync strategy
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:31Z
updated_at: 2026-03-26T20:23:44Z
parent: api-e3hk
blocked_by:
  - api-fc7h
---

Extend existing privacy-config and bucket sync schemas. Add fieldBucketVisibility to privacy-config schema (maps fieldDefinitionId to bucketId array, currently missing). Resolve source-of-truth question: DB friend_bucket_assignments table is authoritative for access control; sync document mirrors assignments as a read-optimized projection for offline clients. On conflict: DB wins, sync document is overwritten on next push. Migration path: existing clients without bucket fields receive defaults on next sync pull. Files: modify packages/sync/src/schemas/privacy-config.ts (add fieldBucketVisibility map), modify bucket.ts (add assignment projection fields), modify crdt-strategies.ts (add merge logic for new fields). Tests: document factory with field visibility data, sync lifecycle (create bucket, assign to field, sync, verify field appears), assignment projection consistency (DB insert triggers sync update, verify convergence), conflict resolution (concurrent field visibility change, DB authoritative).

## Summary of Changes

Added field-bucket-visibility strategy (junction-map type) to ENTITY_CRDT_STRATEGIES in crdt-strategies.ts. Added optional fieldBucketVisibility field to PrivacyConfigDocument in privacy-config.ts schema. Existing documents without this field are handled gracefully (optional field, treat as empty).
