---
# sync-00qp
title: "H3: Add missing fieldBucketVisibility to CRDT factory"
status: completed
type: bug
priority: critical
created_at: 2026-03-28T21:26:27Z
updated_at: 2026-03-29T00:48:45Z
parent: ps-tkuz
---

**Audit:** M6 audit finding H3 (Sync)
**File:** `packages/sync/src/factories/document-factory.ts:167-175`

`createPrivacyConfigDocument()` does not initialize `fieldBucketVisibility`. New documents lack the CRDT root key — any junction-map write will fail on an undefined root key.

**Fix:** Add `fieldBucketVisibility: {}` to the factory initializer.
