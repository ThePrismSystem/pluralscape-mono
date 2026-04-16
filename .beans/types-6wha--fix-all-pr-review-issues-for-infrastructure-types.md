---
# types-6wha
title: Fix all PR review issues for infrastructure types
status: completed
type: task
priority: normal
created_at: 2026-03-09T07:40:53Z
updated_at: 2026-04-16T07:29:41Z
parent: ps-l60w
---

Address all critical, important, and suggestion-level issues from PR review of feat/types-infrastructure branch

## Summary of Changes

- Added FriendNotificationPreferenceId branded type, ID prefix, and EntityType variant
- Added FriendNotificationEventType subset type and id field to FriendNotificationPreference
- Changed Switch.memberIds from readonly MemberId[] to non-empty tuple readonly [MemberId, ...MemberId[]]
- Extracted AuditActor type from AuditLogEntry inline union
- Added JSDoc comments to Poll voting constraints and CoFrontingPair ordering
- Replaced ~17 inline import() references in encryption.ts with top-level imports
- Used AuditActor in ServerAuditLogEntry (replacing inline union)
- Added justification comment to ServerMemberPhoto for omitting AuditMetadata
- Completed doc comments on ServerChannel, ServerBoardMessage, ServerChatMessage
- Added comprehensive tests covering all new types, fields, and Server/Client pairs
- Updated barrel exports and barrel test assertions for all new types
