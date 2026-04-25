---
# ps-q8vs
title: Branded-ID drift cleanup across 5 surfaces
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T14:00:15Z
updated_at: 2026-04-25T05:06:51Z
parent: ps-cd6x
blocked_by:
  - types-f62m
---

Replace bare string / string | null with branded ID types at the 5 surfaces the 2026-04-20 audit flagged in its recurring "Branded-type drift at API/DB boundaries" pattern. Consumes the <Entity> / <Entity>ServerMetadata pairs published by types-f62m.

## Context

The 2026-04-20 audit SUMMARY enumerated 5 specific drift sites. Each uses a raw string where a branded ID type from packages/types/src/ids.ts exists or should exist. Fixing them eliminates the type-level "this could be any string" ambiguity that permits ID-mixup bugs at runtime.

## Scope

- [x] Surface 1 — fixed in cbf22ac2 (api-hgd2, 2026-04-20). cryptoKeyId now ApiKeyId | null.
- [x] Surface 2 — fixed in 59ef63d5 (types-ltel C9, 2026-04-24). bucketId/channelId now BucketId/ChannelId | null.
- [ ] Surface 3 — packages/types: BucketContentTag.entityId typed as plain string. Replace with the union of entity-ID brands it can validly hold (MemberId | GroupId | …) or a dedicated TaggedEntityId brand.
- [x] Surface 4 — DuplicateSystemBodySchema.snapshotId now uses brandedIdQueryParam('snap\_'). Redundant brandId calls removed from system-duplicate.service.ts.
- [x] Surface 5 — verified Brand is already imported from @pluralscape/types (not redefined). Added JSDoc documenting intentional purpose split between brandedString (generic) and brandedIdQueryParam (ID-prefix-strict).
- [ ] Run pnpm typecheck; fix any downstream callers that receive narrower types

## Out of scope

- Other branded-ID drift sites not listed in the 2026-04-20 audit (captured by the hand-rolled types audit ps-6lwp)
- Changing ID brand definitions in packages/types (types-f62m owns that)

## Acceptance

- pnpm typecheck passes
- pnpm test:unit passes across affected packages
- The 5 audit findings are resolved — cross-reference them as closed in the 2026-04-20 audit SUMMARY

## Blocked-by

- types-f62m (publish pairs) — depends on the branded ID types being finalized in packages/types first
