---
# ps-q8vs
title: Branded-ID drift cleanup across 5 surfaces
status: completed
type: task
priority: normal
created_at: 2026-04-21T14:00:15Z
updated_at: 2026-04-27T00:34:50Z
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
- [x] Surface 3 — BucketContentTag is now a discriminated union over (entityType, entityId) for all 21 BucketContentEntityType variants. Row decoder `decodeBucketContentTagRow` added with `_exhaustive: never` lock. Zod schema is `z.discriminatedUnion` with bidirectional compile-time exhaustiveness assertion. CRDT type narrowed; wire JSON unchanged.
- [x] Surface 4 — DuplicateSystemBodySchema.snapshotId now uses brandedIdQueryParam('snap\_'). Redundant brandId calls removed from system-duplicate.service.ts.
- [x] Surface 5 — verified Brand is already imported from @pluralscape/types (not redefined). Added JSDoc documenting intentional purpose split between brandedString (generic) and brandedIdQueryParam (ID-prefix-strict).
- [x] Run pnpm typecheck; fix any downstream callers that receive narrower types — caller cascade fixed across types/validation/sync/api packages, all parity gates green

## Out of scope

- Other branded-ID drift sites not listed in the 2026-04-20 audit (captured by the hand-rolled types audit ps-6lwp)
- Changing ID brand definitions in packages/types (types-f62m owns that)

## Acceptance

- pnpm typecheck passes
- pnpm test:unit passes across affected packages
- The 5 audit findings are resolved — cross-reference them as closed in the 2026-04-20 audit SUMMARY

## Blocked-by

- types-f62m (publish pairs) — depends on the branded ID types being finalized in packages/types first

## Summary of Changes

All 5 surfaces of the 2026-04-20 audit's 'Branded-type drift at API/DB boundaries' finding closed.

- **S1** — fixed in `cbf22ac2` (api-hgd2, 2026-04-20). `cryptoKeyId` now `ApiKeyId | null`.
- **S2** — fixed in `59ef63d5` (types-ltel C9, 2026-04-24). `bucketId`/`channelId` now `BucketId`/`ChannelId | null`.
- **S3** — closed in this PR (`4ffca351`, M9a closeout PR1). `BucketContentTag` is now a discriminated union over 21 entityType variants. `decodeBucketContentTagRow` helper with `_exhaustive: never` lock. `TagContentBodySchema` is `z.discriminatedUnion` with bidirectional compile-time exhaustiveness assertion. `CrdtBucketContentTag` narrowed; wire JSON unchanged. `BucketContentTagResult` alias removed (pre-prod policy: no zero-value aliases).
- **S4** — fixed in `18cc391e` (M9a closeout PR1 quick wins). `DuplicateSystemBodySchema.snapshotId` now uses `brandedIdQueryParam('snap_')`.
- **S5** — fixed in `1069dfb9` (M9a closeout PR1 quick wins). Documented intentional purpose split between `brandedString` (generic) and `brandedIdQueryParam` (ID-prefix-strict).

### Verification (this PR)

- `pnpm types:check-sot` — green (4/4 parity gates)
- `pnpm typecheck` — green (21 packages)
- `pnpm lint` — green (17 packages, zero warnings)
- `pnpm test:unit` — 12,912 passed
- `pnpm test:integration` — 3,055 passed

### Cross-references

- M9a closeout spec: `docs/superpowers/specs/2026-04-26-m9a-closeout-design.md` (PR1)
- Plan: `docs/superpowers/plans/2026-04-24-ps-q8vs-branded-id-drift-cleanup.md` (Tasks 5-7)
