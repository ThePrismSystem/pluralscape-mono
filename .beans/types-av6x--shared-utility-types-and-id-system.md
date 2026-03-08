---
# types-av6x
title: Shared utility types and ID system
status: todo
type: task
priority: critical
created_at: 2026-03-08T13:31:17Z
updated_at: 2026-03-08T19:32:27Z
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

- [ ] All 39 branded ID types defined (not assignable from plain string)
- [ ] ID factory function: `createId<T>(prefix?: string) -> T`
- [ ] ID prefix convention documented
- [ ] EntityType union with 34 entity types
- [ ] Timestamp helper: `now() -> UnixMillis`
- [ ] Both cursor-based and offset-based pagination types
- [ ] Result/Error types: ApiResponse, ApiError, ValidationError
- [ ] CreateInput<T> / UpdateInput<T> utility types
- [ ] DeepReadonly<T> for immutable data
- [ ] DateRange utility type
- [ ] All types exported from package index
- [ ] No `any` or type assertions
- [ ] Unit tests for ID creation and type guards

## References

- ADR 004 (database ID strategy)
- CLAUDE.md code quality rules (strict typing)
