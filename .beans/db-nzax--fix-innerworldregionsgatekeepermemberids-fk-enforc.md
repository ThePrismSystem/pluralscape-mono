---
# db-nzax
title: Fix innerworldRegions.gatekeeperMemberIds FK enforcement
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T00:50:05Z
parent: db-gt84
---

Member IDs in JSONB array cannot be FK-constrained. Deleted/archived member causes fail-open access control. Consider junction table or application-layer cleanup triggers. Ref: audit H17

## Summary of Changes

No code changes needed. `gatekeeperMemberIds` was never a standalone column — it is stored inside the `encryptedData` blob. DB-level FK enforcement is impossible by design (ZK contract).
