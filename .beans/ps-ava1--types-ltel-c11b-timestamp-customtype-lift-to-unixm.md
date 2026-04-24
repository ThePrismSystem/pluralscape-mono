---
# ps-ava1
title: "types-ltel C11b: timestamp customType lift to UnixMillis"
status: completed
type: task
priority: high
created_at: 2026-04-24T09:27:12Z
updated_at: 2026-04-24T13:52:17Z
parent: types-ltel
blocked_by:
  - ps-6hyr
---

Second of three sub-PRs closing out the types-ltel epic (C11).

## Scope

Flip `pgTimestamp` / `sqliteTimestamp` `customType` generics from `{ data: number }` to `{ data: UnixMillis }`.

- [x] Update `packages/db/src/columns/pg.ts`: `customType<{ data: UnixMillis; driverData: string }>`
- [x] Update `packages/db/src/columns/sqlite.ts`: `customType<{ data: UnixMillis; driverData: number }>`
- [x] Add fixture helper `packages/db/src/__tests__/fixtures/timestamps.ts` exporting `fixtureNow()` and `fixtureNowPlus(offsetMs)`
- [x] Replace `Date.now()` timestamp-insert sites across PG + sqlite integration test suites with `fixtureNow()` / `fixtureNowPlus(n)`
- [x] Verify `pnpm turbo typecheck --force` green across all packages
- [x] Verify `/verify` full suite green (unit + integration + E2E + sp-import + pk-import)

## Why read-side needs no changes

`UnixMillis = Brand<number, "UnixMillis"> = number & { __brand }`. Arithmetic and comparison against raw `number` preserves type-compatibility, so the 14 surveyed production sites (e.g. `session.expiresAt <= Date.now()`, `entry.expiresAt - entry.createdAt`) keep typechecking unchanged.

## Why no production writes change

Initial survey flagged `packages/sync/src/post-merge-validator.ts`, but its `detectedAt: Date.now()` populates an in-memory `ConflictNotification` shape (`packages/sync/src/types.ts:184`, field typed as plain `number`), not a Drizzle row — the customType flip does not touch it.

## Parity tests stay green

`Equal<StripBrands<Row>, StripBrands<XServerMetadata>>` flattens `UnixMillis` → `number` on both sides. Tightening happens in C11c.

## Out of scope

- Tightening any parity tests (C11c)
- brandedId lifts (C11a)
- Refactoring `ConflictNotification` to use `UnixMillis`

## Acceptance

- `pnpm typecheck` green
- `pnpm test` green (unit + integration)
- `pnpm test:e2e` green
- New fixture helper has no dead exports
- No production code touched (customType flip + fixture helper additions only)

## Spec

`docs/superpowers/specs/2026-04-24-types-ltel-c11-cleanup-design.md`

## Summary of Changes

**Commits on feat/types-ltel-c11b-timestamp-lift:**

- 5a0d3f28 test(db): add fixtureNow/fixtureNowPlus timestamp helpers
- 0b77293c feat(db): lift timestamp customType to UnixMillis
- cc779845 test(db): migrate PG fixture timestamps
- e1fb6fa7 test(db): migrate sqlite fixture timestamps
- 19799540 refactor(api,queue): narrow timestamp call-sites to UnixMillis

**Scope evolution vs design spec:**
The design claimed zero production write-sites affected. In practice, flipping the customType surfaced two additional production surfaces:

1. `packages/db/src/columns/{pg,sqlite}.ts` mapper fn signatures (timestampToDriver / timestampFromDriver) — flipped to accept/return UnixMillis.
2. `packages/db/src/queries/` production call-sites: audit-log-cleanup, device-transfer-cleanup, recovery-key (StoreRecoveryKeyInput, ReplaceRecoveryKeyInput, pg/sqliteRevokeRecoveryKey).
3. `apps/api/` (~67 files) and `packages/queue/` row-mapper test — production cursor/comparison/threshold sites feeding Drizzle `.where` / `.values` / `.set` needed `toUnixMillis(...)` at the boundary.

Parity tests untouched (C11c tightens them). `/verify` full suite green.

Unblocks ps-z7j6 (C11c, epic closeout).
