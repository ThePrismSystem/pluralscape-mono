---
# types-f62m
title: Publish <Entity> and <Entity>ServerMetadata pairs in packages/types
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:55:29Z
updated_at: 2026-04-24T09:07:46Z
parent: types-ltel
---

Establish the canonical two-type-per-entity pattern in packages/types for every domain entity. Foundation for all downstream parity tests.

## Context

The <Entity> type describes the full decrypted domain shape (all fields as they appear after client-side decryption). The <Entity>ServerMetadata type describes what the server actually sees: IDs, scalars used for RLS/indexing/filtering/pagination, timestamps, and encryptedData: Uint8Array. Client code works with <Entity>; server code works with <Entity>ServerMetadata.

## Scope

- [ ] Enumerate every domain entity requiring both shapes (members, groups, buckets, fronting sessions, custom fronts, custom fields, field values, check-ins, relationships, notes, polls, boards, messages, webhooks, etc.)
- [ ] For each, audit packages/types for an existing type and either rename to <Entity> or define it
- [ ] For each, derive <Entity>ServerMetadata by inspecting the corresponding Drizzle table in packages/db/src/schema/pg/
- [ ] Export both from packages/types/src/index.ts with branded IDs from packages/types/src/ids.ts
- [ ] Ensure packages/validation's brandedString base helper re-exports from packages/types rather than redefining (linked 2026-04-20 audit finding)

## Out of scope

- Writing the parity tests (sibling tasks)
- Refactoring consumers (sibling branded-ID cleanup task under the milestone handles this)

## Acceptance

- pnpm typecheck passes across the monorepo
- Each entity has both <Entity> and <Entity>ServerMetadata exported from @pluralscape/types
- No existing consumer breaks (the pattern is additive; existing exports kept stable where possible or renamed with a codemod PR)

## Notes

This task is a prerequisite for the Drizzle-parity and Zod-parity tasks. Expect to touch ~20+ entity types.

## Phase 1 pilot progress (2026-04-22)

Pilot-scope delivered: `MemberServerMetadata` + `MemberWire` and `AuditLogEntryServerMetadata` + `AuditLogEntryWire` published in `@pluralscape/types`. `ClientMember` / `ClientAuditLogEntry` aliases removed. `__brand` symbol marked `@internal`; `PendingAccountId` migrated to canonical `Brand<T, B>`.

Remaining (fleet, Phase 2): ~23 entities across the six clusters in the spec. Pattern is established — rename existing `Server<Entity>` to `<Entity>ServerMetadata`, drop `Client<Entity>` aliases, add `<Entity>Wire = Serialize<Entity>`.

## Summary of Changes

All 20 domain entity pairs now published in packages/types/src/entities/ with <Entity> and <Entity>ServerMetadata shapes. Landed across Phase 0/1 pilot (#538), types-tef0 (#540), and fleet clusters C1-C10 (#542-#551). 58 entity files total in packages/types/src/entities/. Branded IDs consolidated in packages/types/src/ids.ts; validation's brandedString re-exports from types. Wire forms (<Entity>Wire = Serialize<Entity>) published alongside each pair.
