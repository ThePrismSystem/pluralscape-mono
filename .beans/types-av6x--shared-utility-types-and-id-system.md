---
# types-av6x
title: Shared utility types and ID system
status: completed
type: task
priority: critical
created_at: 2026-03-08T13:31:17Z
updated_at: 2026-03-09T00:14:58Z
parent: types-im7i
blocking:
  - types-fid9
  - types-itej
  - types-c2eu
  - types-qryr
  - types-rwnq
  - types-296i
  - types-8klm
  - types-0jjx
  - types-iz5j
  - types-ae5n
---

Shared utility types and branded ID system for packages/types.

## Scope

### Branded ID types

Opaque string wrappers — not assignable from plain string:

`SystemId`, `MemberId`, `GroupId`, `BucketId`, `ChannelId`, `MessageId`, `NoteId`, `PollId`, `RelationshipId`, `SubsystemId`, `FieldDefinitionId`, `FieldValueId`, `SessionId`, `EventId`, `AccountId`, `BlobId`, `ApiKeyId`, `WebhookId`, `TimerId`, `JournalEntryId`, `WikiPageId`, `SideSystemId`, `LayerId`, `InnerWorldEntityId`, `InnerWorldRegionId`, `AuditLogEntryId`, `BoardMessageId`, `AcknowledgementId`, `CheckInRecordId`, `FriendConnectionId`, `KeyGrantId`, `FrontingSessionId`, `CustomFrontId`, `FriendCodeId`, `PollVoteId`, `DeviceTokenId`, `NotificationConfigId`, `SystemSettingsId`, `PollOptionId`

### ID prefix convention

IDs use a prefix convention for human readability: `sys_`, `mem_`, `grp_`, `bkt_`, `ch_`, `msg_`, `note_`, `poll_`, `rel_`, `sub_`, `fld_`, `fv_`, `sess_`, `evt_`, `acct_`, `blob_`, `ak_`, `wh_`, `tmr_`, `je_`, `wp_`, `ss_`, `lyr_`, `iwe_`, `iwr_`, `al_`, `bm_`, `ack_`, `cir_`, `fc_`, `kg_`, `fs_`, `cf_`, `frc_`, `pv_`, `dt_`, `nc_`, `sset_`, `po_`

### EntityType union

`'system' | 'member' | 'group' | 'bucket' | 'channel' | 'message' | 'note' | 'poll' | 'relationship' | 'subsystem' | 'side-system' | 'layer' | 'journal-entry' | 'wiki-page' | 'custom-front' | 'fronting-session' | 'blob' | 'webhook' | 'timer' | 'board-message' | 'acknowledgement' | 'innerworld-entity' | 'innerworld-region' | 'field-definition' | 'field-value' | 'api-key' | 'audit-log-entry' | 'check-in-record' | 'friend-connection' | 'key-grant' | 'device-token' | 'poll-vote'`

### Timestamp types

- `UnixMillis` (branded number)
- `ISOTimestamp` (branded string)

### Pagination types

- `PaginationCursor`, `PaginatedResult<T>` (cursor-based)
- `OffsetPaginationParams`: { offset: number, limit: number }

### Result/Error types

- `Result<T, E>`: discriminated union for success/error
- `ApiResponse<T>`: { data: T } | { error: ApiError }
- `ApiError`: { code: string, message: string, details?: unknown }
- `ValidationError`: { field: string, message: string, code: string }

### Utility types

- `CreateInput<T>`: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'> for creation
- `UpdateInput<T>`: Partial<Omit<T, 'id' | 'createdAt'>> for updates
- `DeepReadonly<T>`: recursive readonly for immutable data (lifecycle events, audit logs)
- `DateRange`: { start: UnixMillis, end: UnixMillis }
- `AuditMetadata`: { createdAt: UnixMillis, updatedAt: UnixMillis, version: number }
- `SortDirection`: 'asc' | 'desc'
- `EntityReference`: { entityType: EntityType, entityId: string }

## Acceptance Criteria

- [x] All 39 branded ID types defined (not assignable from plain string)
- [x] ID factory function: deferred to runtime utils package
- [x] ID prefix convention documented (ID_PREFIXES const)
- [x] EntityType union with 32 entity types
- [x] Timestamp helper: deferred to runtime utils package
- [x] Both cursor-based and offset-based pagination types
- [x] Result/Error types: ApiResponse, ApiError, ValidationError
- [x] CreateInput<T> / UpdateInput<T> utility types
- [x] DeepReadonly<T> for immutable data
- [x] DateRange utility type
- [x] All types exported from package index
- [x] No any or type assertions
- [x] Type-level tests for branded IDs and all utility types (64 tests)

## References

- ADR 004 (database ID strategy)
- CLAUDE.md code quality rules (strict typing)

## Summary of Changes

Implemented all shared utility types and branded ID system in packages/types/src/:

- ids.ts: Brand<T,B> type, 39 branded ID types, ID_PREFIXES const, EntityType union
- timestamps.ts: UnixMillis (branded number), ISOTimestamp (branded string)
- pagination.ts: PaginationCursor, PaginatedResult<T>, OffsetPaginationParams
- results.ts: Result<T,E>, ApiResponse<T>, ApiError, ValidationError
- utility.ts: CreateInput<T>, UpdateInput<T>, DeepReadonly<T>, DateRange, AuditMetadata, SortDirection, EntityReference

Runtime helpers (createId, now) deferred to follow-up bean for runtime utils package.

## Post-Review Fixes

- Added MemberPhotoId branded type and mp\_ prefix (40 total)
- Added 8 missing EntityType members (session, event, account, friend-code, notification-config, system-settings, poll-option, member-photo)
- UpdateInput now strips updatedAt and version (matching CreateInput)
- DeepReadonly guards for Map, Set, Date, and Function
- EntityReference made generic: EntityReference<T extends EntityType = EntityType>
- DateRange JSDoc documents start <= end invariant
- ID_PREFIXES uniqueness and count alignment tests
- Brand generic test with non-string base type
- Additional non-interchangeability spot checks
