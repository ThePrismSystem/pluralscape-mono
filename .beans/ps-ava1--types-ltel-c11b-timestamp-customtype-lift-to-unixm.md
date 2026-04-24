---
# ps-ava1
title: "types-ltel C11b: timestamp customType lift to UnixMillis"
status: todo
type: task
priority: high
created_at: 2026-04-24T09:27:12Z
updated_at: 2026-04-24T09:28:50Z
parent: types-ltel
blocked_by:
  - ps-6hyr
---

Second of three sub-PRs closing out the types-ltel epic (C11).

## Scope

Flip `pgTimestamp` / `sqliteTimestamp` `customType` generics from `{ data: number }` to `{ data: UnixMillis }`.

- [ ] Update `packages/db/src/columns/pg.ts` (line 61): `customType<{ data: UnixMillis; driverData: string }>`
- [ ] Update `packages/db/src/columns/sqlite.ts` (line 45): `customType<{ data: UnixMillis; driverData: number }>`
- [ ] Add fixture helper `packages/db/src/__tests__/fixtures/timestamps.ts` exporting `fixtureNow()` and `fixtureNowPlus(offsetMs)`
- [ ] Replace ~126 `Date.now()` timestamp-insert sites across ~30 test files with `fixtureNow()` / `fixtureNowPlus(n)`
- [ ] Top offenders (verify during implementation): `schema-{pg,sqlite}-auth.integration.test.ts` (20 each), `schema-*-key-rotation.integration.test.ts` (6 each), `schema-pg-sync.integration.test.ts` (6), `bullmq-queue.integration.test.ts` (6)
- [ ] Verify `pnpm typecheck` green across all packages
- [ ] Verify `pnpm test` + `pnpm test:integration` green

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
