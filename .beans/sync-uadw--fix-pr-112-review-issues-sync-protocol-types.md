---
# sync-uadw
title: "Fix PR #112 review issues — sync protocol types"
status: completed
type: task
priority: normal
created_at: 2026-03-15T02:08:10Z
updated_at: 2026-04-16T07:29:41Z
parent: sync-xlhb
---

Address review findings from PR #112: rename types, narrow string types to SyncDocumentType, add missing error codes, update docs and add new test files.

## Summary of Changes

- Narrowed `string` types to `SyncDocumentType` in `TimeSplitConfig.documentType` and `DOCUMENT_SIZE_LIMITS`
- Added `SyncPriorityCategory` type and narrowed `SYNC_PRIORITY_ORDER`
- Renamed `OwnerLiteConfig` → `OwnerLiteProfile`, `FriendProfileConfig` → `FriendProfile`
- Changed `FriendProfile.grantedBucketIds` from `ReadonlySet<string>` to `readonly string[]`
- Renamed `DocumentLoadRequest` → `OnDemandLoadRequest` with `docId` field (replication layer)
- Renamed `DEFAULT_OWNER_LITE_CONFIG` → `DEFAULT_OWNER_LITE_PROFILE`
- Renamed `documentId` → `docId` in protocol `DocumentLoadRequest`
- Narrowed `AuthenticateRequest.protocolVersion` to `typeof SYNC_PROTOCOL_VERSION`
- Added `@security` JSDoc to `sessionToken`
- Added `DOCUMENT_LOAD_DENIED` and `SNAPSHOT_NOT_FOUND` error codes
- Updated all three spec docs to match type/field renames
- Added `protocol.test.ts` (12 tests) and `replication-profiles.test.ts` (9 tests)
- Removed `ProtocolDocumentLoadRequest` alias from index.ts re-exports
- Created follow-up bean sync-5gdu for branded protocol IDs
