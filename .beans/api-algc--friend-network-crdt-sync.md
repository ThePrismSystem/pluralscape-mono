---
# api-algc
title: Friend network CRDT sync
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:12Z
updated_at: 2026-03-27T00:29:36Z
parent: api-rl9o
blocked_by:
  - api-8312
---

Friend connections, codes, and bucket assignments sync via the privacy-config CRDT document. Extend existing packages/sync/src/schemas/privacy-config.ts to include: friendCodes array (code, status, createdAt, archivedAt), friendConnections map keyed by connectionId (status, friendAccountId, visibility encrypted blob, assignedBucketIds array), friendBucketAssignments map keyed by compositeKey (bucketId, connectionId, grantedAt, revokedAt). Conflict resolution: LWW on individual fields within each connection/assignment; array-union on assignedBucketIds with tombstone for revocations. Security: privacy-config document is system-scoped, never shared with friends — friend-facing data uses separate read-only projections via the dashboard/data endpoints. Files: modify packages/sync/src/schemas/privacy-config.ts, add friend-related field definitions. Tests: document factory with friend data, sync merge with concurrent connection status changes, assignment add/revoke conflict resolution, verify friend-facing endpoints never expose raw sync state.

## Summary of Changes\n\nCreated CRDT projection functions for friend network data in packages/sync/src/projections/friend-projection.ts. 11 projection functions: 3 pure projectors (friendCode, friendConnection, keyGrant), 3 apply functions, and 5 mutation functions (archive, status update, visibility update, bucket assignment, key grant revocation). 21 unit tests.
