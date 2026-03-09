---
# types-gnx5
title: PluralKit bridge types
status: completed
type: task
priority: normal
created_at: 2026-03-08T18:49:48Z
updated_at: 2026-03-09T08:22:19Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Types for PluralKit bridge bidirectional sync.

## Scope

- `PKBridgeConfig`: systemId (SystemId), pkToken (string — T1 encrypted), syncDirection (PKSyncDirection), lastSyncAt (UnixMillis | null), enabled (boolean)
- `PKSyncDirection`: 'to-pk' | 'from-pk' | 'bidirectional'
- `PKSyncState`: systemId, lastSyncAt (UnixMillis | null), entityMappings (PKEntityMapping[]), errorLog (PKSyncError[]), syncStatus (PKSyncStatus)
- `PKSyncStatus`: 'idle' | 'syncing' | 'error' | 'paused'
- `PKEntityMapping`: psEntityId (string), pkEntityId (string — PK 5-char ID), entityType ('member' | 'group' | 'switch'), lastSyncedVersion (number), lastSyncedAt (UnixMillis)
- `PKSyncError`: timestamp (UnixMillis), entityType (string), entityId (string), message (string), recoverable (boolean)
- Bridge runs client-side (requires app to be open)

## Acceptance Criteria

- [ ] PKBridgeConfig with token (T1), direction, enabled
- [ ] PKSyncState with entity mappings and error log
- [ ] PKEntityMapping for bidirectional ID resolution
- [ ] Unit tests for entity mapping resolution

## References

- features.md section 9 (PluralKit bridge)
- DB bean: db-btrp

## Summary of Changes

Implemented in `packages/types/src/pk-bridge.ts` on branch `feat/types-interop`:

- `PKSyncDirection`: `"ps-to-pk" | "pk-to-ps" | "bidirectional"`
- `PKSyncStatus`: `"idle" | "syncing" | "error" | "paused"`
- `PKBridgeConfig`: bridge configuration with systemId, token, direction, enabled flag
- `PKEntityMapping`: maps PS entity IDs to PK entity IDs with sync timestamps
- `PKSyncState`: current sync state with status, pending changes, and mappings
- `PKSyncError`: sync error with code, message, retryability

Test file: `pk-bridge.test.ts` (10 tests). All fields use plain string IDs (not branded) since PK uses its own ID format.

## PR #39 Review Fixes

- PKBridgeConfig now extends AuditMetadata (adds version, removes explicit createdAt/updatedAt)
- PKBridgeConfig uses PKBridgeConfigId and EncryptedString for pkToken
- PKEntityMapping refactored to discriminated union (PKMemberMapping | PKGroupMapping | PKSwitchMapping)
- Added PKSyncableEntityType and PKSyncErrorCode typed unions
- PKSyncError.code now typed as PKSyncErrorCode instead of string
- Tests rewritten for discriminated union narrowing and exhaustive switch coverage
