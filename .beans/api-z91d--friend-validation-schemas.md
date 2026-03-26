---
# api-z91d
title: Friend validation schemas
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:42Z
updated_at: 2026-03-26T23:24:52Z
parent: api-rl9o
---

Create Zod schemas: GenerateFriendCodeBodySchema (no body required, generates server-side), RedeemFriendCodeBodySchema (code: required string matching XXXX-XXXX alphanumeric format), UpdateFriendVisibilityBodySchema (encryptedData: required base64 blob string), AssignBucketBodySchema (bucketId: required UUID), FriendConnectionQuerySchema (cursor: optional string, limit: 1-100 default 50). Files: packages/validation/src/friend.ts (new), re-export from index.ts. Tests: unit tests for each schema covering valid input, boundary cases (malformed code formats like "XXXX-XXXX-XXXX" or "xxxx", empty visibility blob, limit=0, limit=101, invalid cursor format), and invalid input (missing required fields, non-UUID bucketId, non-base64 encryptedData).

## Summary of Changes\n\nCreated packages/validation/src/friend.ts with 5 Zod schemas: RedeemFriendCodeBodySchema (XXXX-XXXX regex), UpdateFriendVisibilityBodySchema (encryptedData + OCC version), AssignBucketBodySchema (branded bucketId + encryptedBucketKey + keyVersion), FriendConnectionQuerySchema (cursor/limit with defaults), FriendCodeQuerySchema (includeExpired boolean). Re-exported from index.ts. Full test coverage in friend.test.ts.
