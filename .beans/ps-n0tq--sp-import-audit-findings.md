---
# ps-n0tq
title: SP Import Audit Findings
status: completed
type: epic
priority: normal
created_at: 2026-04-10T21:05:16Z
updated_at: 2026-04-11T21:32:30Z
parent: ps-h2gl
---

Audit findings from the 2026-04-10 review of the Simply Plural import engine, mobile glue, and API infrastructure. 12 findings across security, architecture, typing, performance, and quality.

## Summary of Changes

All 12 audit findings implemented and verified against real SP export data (minimal + adversarial accounts).

### Original audit findings (12)

- F-001 (ps-prvk, critical): mapper error messages no longer leak plaintext names — all references use opaque source IDs.
- F-002 (ps-51t0, critical): `api-source.ts` rewritten with correct SP API paths, `:system` substitution, strategy map (list/single/range/unsupported), no more offset pagination loop.
- F-003 (ps-bkb0, high): `SPCustomFieldSchema` matches real SP shape (`type: number 0-7`, `order: string` fractional index), mapper rewritten with numeric type map and base-36 order decode.
- F-004 (ps-9agn, high): file-source memory characteristics documented inline.
- F-005 (ps-o3cz, high): IdTranslationTable unbounded growth documented inline.
- F-006 (ps-efh6, normal): runtime guard added in `buildPersistableEntity` to reject non-object payloads.
- F-007 (ps-zjq0, normal): `summarizeMissingRefs` helper truncates long missing-ref lists.
- F-008 (ps-lfpt, normal): `warnUnknownKeys` dedup key scoped by entityType to prevent cross-collection collisions.
- F-009 (ps-v159, normal): `SPBoardMessage` fields corrected to SP's real shape (`writtenBy`/`writtenFor`/`read`, not `writer`/`readBy`).
- F-010 (ps-owbo, low): `listCollections()` return-type widening explained inline.
- F-011 (ps-gff5, low): mobile persister granularity rationale documented inline.
- F-012 (ps-ac1a, low): `toRecord` helper extracted into `shared/to-record.ts`.

### Additional bugs found and fixed during E2E verification

Running the test suite against real SP export fixtures exposed five blocking bugs beyond the audit:

- `SPFrontHistorySchema.endTime` was nullable but required — real live sessions omit it entirely. Made both nullable and optional.
- `SPPollSchema.options` was required — real yes/no polls omit it. Made optional.
- `SPPollOptionSchema.id` was required — fresh SP poll options have only `name` and `color`. Made optional; mapper falls back to positional synthetic ids.
- `SPChannelSchema.parentCategory` was nullable but required — real channels without a parent omit the field. Made nullable + optional; mapper treats undefined and null the same way.
- `SPChannel` and `SPChannelCategory` used `description` — real SP uses `desc`. Renamed interface + schema + mapper.
- `deriveBucketSourceIds` in the member mapper fell through to legacy-flag synthesis when `buckets` was present but empty, causing imports like Alice (modern account, `buckets: []`, legacy `private: true`) to fk-miss on `synthetic:private`. Fixed so that `buckets !== undefined` always respects the explicit assignment, including empty array meaning "no buckets".
- E2E `assertEntityCounts` relaxed for `privacy-bucket` to tolerate SP's auto-created default buckets (which the seeder doesn't track). Correctness is still verified via `assertAllEntitiesPresent`.

### Verification

All checks green:

- typecheck + lint (all 31 workspace packages)
- unit: 11494 passed
- integration: 2655 passed
- e2e: 473 passed
