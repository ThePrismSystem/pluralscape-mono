---
# sync-1vf5
title: Ratchet sync LOC cap from 1100 to 750 (split post-merge-validator.ts)
status: completed
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T12:32:55Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split packages/sync/src/post-merge-validator.ts (currently 1096 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 1100 to 750. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md

## Summary of Changes

Split packages/sync/src/post-merge-validator.ts (1096 LOC) into:

- post-merge-validator.ts — runAllValidations orchestrator + barrel re-exports (270 LOC)
- validators/internal.ts — DocRecord, ArchivableEntity, ParentableEntity, SortableEntity, getEntityMap, getParentId, ENTITY_FIELD_MAP, getEntityTypeByFieldName (76 LOC)
- validators/tombstones.ts — enforceTombstones (80 LOC)
- validators/hierarchy-cycles.ts — detectHierarchyCycles + detectCyclesForField (131 LOC)
- validators/sort-order.ts — normalizeSortOrder + collectSortOrderPatches + partitionByGroupField (126 LOC)
- validators/check-in.ts — normalizeCheckInRecord (50 LOC)
- validators/friend-connection.ts — normalizeFriendConnection (64 LOC)
- validators/fronting.ts — normalizeFrontingSessions + normalizeFrontingCommentAuthors (134 LOC)
- validators/timer-config.ts — normalizeTimerConfig (92 LOC)
- validators/webhook-config.ts — normalizeWebhookConfigs + VALID_WEBHOOK_EVENT_TYPES (96 LOC)
- validators/bucket-content-tags.ts — validateBucketContentTags (74 LOC)

All public validators re-exported from post-merge-validator.ts so existing test imports keep working. Lowered B11 cap in tooling/eslint-config/loc-rules.js from 1100 to 750. 951 sync tests pass unchanged.

Verified: pnpm typecheck, pnpm lint --filter=@pluralscape/sync, pnpm vitest run --project sync (951 passed), pnpm lint:loc — all pass.
