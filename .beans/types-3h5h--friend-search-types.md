---
# types-3h5h
title: Friend search types
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:05:42Z
updated_at: 2026-03-29T00:48:46Z
parent: client-q5jh
---

Define FriendSearchableEntityType, FriendSearchQuery — client-only types for local FTS5 search. Files: extend packages/types/src/friend-data.ts. Tests: compile-time type assertions using vitest `expectTypeOf` to verify FriendSearchableEntityType is a union of specific entity types (member, customFront, group, fieldDefinition, fieldValue) and FriendSearchQuery fields (query string, entityTypes optional filter array, limit/offset). Runtime exhaustive-switch tests on entity type union members.
