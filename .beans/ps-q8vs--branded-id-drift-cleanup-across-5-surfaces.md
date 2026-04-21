---
# ps-q8vs
title: Branded-ID drift cleanup across 5 surfaces
status: todo
type: task
priority: normal
created_at: 2026-04-21T14:00:15Z
updated_at: 2026-04-21T14:00:39Z
parent: ps-cd6x
blocked_by:
  - types-f62m
---

Replace bare string / string | null with branded ID types at the 5 surfaces the 2026-04-20 audit flagged in its recurring "Branded-type drift at API/DB boundaries" pattern. Consumes the <Entity> / <Entity>ServerMetadata pairs published by types-f62m.

## Context

The 2026-04-20 audit SUMMARY enumerated 5 specific drift sites. Each uses a raw string where a branded ID type from packages/types/src/ids.ts exists or should exist. Fixing them eliminates the type-level "this could be any string" ambiguity that permits ID-mixup bugs at runtime.

## Scope

- [ ] Surface 1 — apps/api: WebhookConfigResult uses `string | null` for IDs where branded IDs exist. Replace with WebhookConfigId / SystemId / etc.
- [ ] Surface 2 — packages/types: SyncDocument.bucketId and SyncDocument.channelId typed as plain strings. Replace with BucketId and ChannelId (or define them if missing in ids.ts).
- [ ] Surface 3 — packages/types: BucketContentTag.entityId typed as plain string. Replace with the union of entity-ID brands it can validly hold (MemberId | GroupId | …) or a dedicated TaggedEntityId brand.
- [ ] Surface 4 — packages/validation: DuplicateSystemBodySchema.snapshotId uses bare string. Replace with the branded SystemSnapshotId.
- [ ] Surface 5 — packages/validation: brandedString base helper redefines the branding pattern rather than re-exporting from packages/types/src/ids.ts. Replace with a re-export.
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
