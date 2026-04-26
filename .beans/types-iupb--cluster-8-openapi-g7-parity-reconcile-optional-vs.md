---
# types-iupb
title: 'Cluster 8 OpenAPI G7 parity: reconcile optional-vs-nullable for hybrid encrypted entities'
status: todo
type: task
priority: normal
created_at: 2026-04-26T05:03:58Z
updated_at: 2026-04-26T05:03:58Z
blocked_by:
    - ps-etbc
---

## Background

ps-etbc PR #562 converted the OpenAPI ↔ Wire parity carve-out to G7 full equality (`Equal<<X>Response, <X>Wire>`) for 10 entities: FieldDefinition, FieldValue, FrontingComment, Group, CustomFront, StructureEntityType, StructureEntity, Region, Entity, Canvas.

Cluster 8 hybrids (Channel, ChatMessage, Note, BoardMessage, Poll, TimerConfig) and Acknowledgement / JournalEntry / WikiPage have canonical wire types but did NOT convert because the OpenAPI generator emits `field?: T` (optional) for several plaintext columns where the canonical type declares `field: T | null` (required-nullable).

## Reproduction

```bash
# In scripts/openapi-wire-parity.type-test.ts add:
expectTypeOf<Equal<components["schemas"]["ChannelResponse"], ChannelWire>>().toEqualTypeOf<true>();
# typecheck fails with "Expected: true, Actual: false"
```

Concrete known gap: `Channel.parentId: ChannelId | null` (required-nullable) vs OpenAPI `parentId?: string | null` (optional-nullable). Same pattern across the cluster.

## Decision needed

Two paths forward:

1. **Tighten OpenAPI spec**: change `parentId` (and the equivalent fields per entity) to required-nullable in the OpenAPI source spec. Re-generate `api-types.ts`. This is the cleanest fix and mirrors how the pilot entities converged.
2. **Widen canonical types**: change `Channel.parentId: ChannelId | null` to `parentId?: ChannelId | null` to match the wire. This contradicts the SoT principle (types own the contract; OpenAPI derives) and should not be the default.

Recommended: option 1 unless review surfaces a concrete reason a column should be optional rather than nullable.

## Scope

For each of the following entities:
- Identify each plaintext column where OpenAPI emits `?: T` but the canonical type declares `T | null` (or vice versa)
- Reconcile in the OpenAPI spec (preferred) or canonical type
- Add `Equal<<X>Response, <X>Wire>` G7 assertion to `scripts/openapi-wire-parity.type-test.ts`
- Verify `pnpm types:check-sot` passes

**Entities (9):** Channel, ChatMessage (MessageResponse), Note, BoardMessage, Poll, TimerConfig, AcknowledgementRequest, JournalEntry, WikiPage.

PollVote needs a separate path — its OpenAPI response is a hand-rolled shape (not `EncryptedEntity & {…}`) and currently relies on `PollVoteServerWire = Omit<PollVoteWire, "systemId" | "version" | "updatedAt">` in the data transform. G7 against the canonical wire isn't directly possible; either widen the API response, or assert against the ServerWire shim.

## Out of scope

- Per-entity transform rewrites (already done in ps-etbc)
- Adding new entities to the manifest (already done in ps-etbc)

## Acceptance

- [ ] G7 `Equal<<X>Response, <X>Wire>` assertions land for all 9 cluster entities
- [ ] `pnpm types:check-sot` passes
- [ ] PollVote G7 path documented (either implemented or formally deferred with reason)
- [ ] Inline "Cluster 8 (deferred)" comment block in `openapi-wire-parity.type-test.ts` removed

## Cross-references

- Parent: ps-y4tb
- Blocked-by: ps-etbc (PR #562)
- File: `scripts/openapi-wire-parity.type-test.ts` lines around the "Cluster 8 (deferred)" block
