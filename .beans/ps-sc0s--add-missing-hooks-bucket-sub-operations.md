---
# ps-sc0s
title: "Add missing hooks: bucket sub-operations"
status: completed
type: task
priority: high
created_at: 2026-04-06T00:52:38Z
updated_at: 2026-04-06T05:29:38Z
parent: ps-y621
---

No hooks for bucket sub-operations. Create hooks for:

- bucket.tagContent, bucket.untagContent, bucket.listTags (content tagging)
- bucket.initiateRotation, bucket.rotationProgress, bucket.claimRotationChunk, bucket.completeRotationChunk, bucket.retryRotation (key rotation)
- bucket.exportManifest, bucket.exportPage (export)
- bucket.assignFriend, bucket.unassignFriend, bucket.listFriendAssignments (friend assignment)

Audit ref: Pass 1 MEDIUM (4 findings)

## Summary of Changes\n\nAdded 13 hooks for bucket sub-operations: content tagging (3), key rotation (5), export (2), friend assignment (3). All remote-only.
