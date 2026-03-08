---
# types-av6x
title: Shared utility types and ID system
status: todo
type: task
priority: critical
created_at: 2026-03-08T13:31:17Z
updated_at: 2026-03-08T14:21:14Z
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

Branded ID system, timestamp types, pagination, Result/Error union, audit metadata for packages/types

Shared utility types and branded ID system for packages/types.

## Scope

- Branded ID types using opaque string wrappers: `SystemId`, `MemberId`, `GroupId`, `BucketId`, `ChannelId`, `MessageId`, `NoteId`, `PollId`, `RelationshipId`, `SubsystemId`, `FieldDefinitionId`, `FieldValueId`, `SessionId`, `EventId`
- Timestamp types: `UnixMillis` (number), `ISOTimestamp` (string)
- Cursor-based pagination types: `PaginationCursor`, `PaginatedResult<T>`
- Result/Error union: `Result<T, E>` pattern or discriminated union
- Audit metadata type: `{ createdAt: UnixMillis, updatedAt: UnixMillis, version: number }`
- Sort direction enum: `asc` | `desc`
- Entity reference type: `{ entityType: EntityType, entityId: string }`

## Acceptance Criteria

- [ ] All ID types are branded (not assignable from plain string)
- [ ] ID factory function: `createId<T>(prefix?: string) -> T`
- [ ] Timestamp helper: `now() -> UnixMillis`
- [ ] Pagination types support cursor-based and offset-based
- [ ] All types exported from package index
- [ ] No `any` or type assertions
- [ ] Unit tests for ID creation and type guards

## References

- ADR 004 (database ID strategy)
- CLAUDE.md code quality rules (strict typing)

## Audit Findings (002)

- Missing 17 branded IDs that need to be added: `AccountId`, `BlobId`, `ApiKeyId`, `WebhookId`, `TimerId`, `JournalEntryId`, `WikiPageId`, `SideSystemId`, `LayerId`, `InnerWorldEntityId`, `InnerWorldRegionId`, `AuditLogEntryId`, `BoardMessageId`, `AcknowledgementId`, `CheckInRecordId`, `FriendConnectionId`, `KeyGrantId`
- Missing `EntityType` union: 'member' | 'group' | 'note' | 'channel' | 'journal-entry' | 'wiki-page' | 'bucket' | 'subsystem' | 'side-system' | 'layer' | etc. (referenced by EntityReference but not defined)
- Missing `DateRange` utility type: `{ start: UnixMillis, end: UnixMillis }` — used by analytics, reports, exports
- Missing `OffsetPaginationParams` type (only cursor-based defined)
- Missing `CreateInput<T>` / `UpdateInput<T>` utility types for API operations (Omit auto-generated fields for creation, Partial for updates)
- Missing `ApiResponse<T>` / `ApiError` envelope types
- Missing `ValidationError` per-field validation type
- Missing `FilterOperator` type for query builders
- Missing `SortSpec<T>` typed sort specification
- Missing `DeepReadonly<T>` for immutable data (lifecycle events, audit logs)
