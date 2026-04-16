---
# db-iut1
title: "Fix all PR #237 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-22T07:32:46Z
updated_at: 2026-04-16T07:29:47Z
parent: ps-mmpz
---

Address all critical, important, and suggestion-level issues from the multi-model PR review of the structure entity DB refactor.

## Summary of Changes

Fixed all critical, important, and suggestion-level issues from the multi-model PR #237 review:

**Critical**: Fixed type nullability mismatches for ServerFrontingSession.memberId, ServerRelationship.sourceMemberId/targetMemberId, Relationship.sourceMemberId/targetMemberId, and FrontingSessionBase.memberId (all now nullable to match DB schema).

**Important**: Added unique constraints on systemStructureEntityLinks and systemStructureEntityMemberLinks; added fieldDefinitionScopes to deleteFieldDefinition dependent checks; added fieldValues.groupId to deleteGroup dependent checks; fixed TOCTOU by moving assertions inside transactions in field-value.service.ts; added SQLite nullsNotDistinct comment; added missing tests (exclusivity, RESTRICT, RLS, cascade, uniqueness).

**Suggestions**: Extracted shared CHECK helpers (exclusiveNullCheck, atLeastOneNotNull) into check.ts; replaced single-column indexes with composite (systemId, x) indexes; removed Db prefix alias; documented association directionality; wrapped listAllMemberMemberships in transaction; moved MAX_ENCRYPTED_FIELD_VALUE_BYTES to constants file; refactored deleteMember mock chain with table comments.

Created follow-up bean api-l9ar for structure entity service with HAS_DEPENDENTS checking.
