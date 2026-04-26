---
# types-wozj
title: "LifecycleEvent transform: canonical type chain migration"
status: completed
type: task
priority: normal
created_at: 2026-04-26T05:04:22Z
updated_at: 2026-04-26T10:23:59Z
blocked_by:
  - ps-etbc
---

## Background

ps-etbc PR #562 migrated 25 of 26 active client-side transforms in `packages/data/src/transforms/` to the canonical type chain (functions only, no local types, validation via `<X>EncryptedInputSchema.parse()`).

`lifecycle-event.ts` was excluded from the rollout because LifecycleEvent is a discriminated union (`SplitEvent | FusionEvent | DiscoveryEvent | ArchivalEvent` + 8 more event types), each variant with its own encrypted-fields keys. The Member-pilot pattern doesn't apply directly — the encrypted blob's plaintext shape varies per variant, and a single `Pick<LifecycleEvent, LifecycleEventEncryptedFields>` doesn't capture the per-variant schema correctly.

## Current state

`packages/data/src/transforms/lifecycle-event.ts` retains:

- `LifecycleEventDecrypted = LifecycleEvent` alias (dead — exists only because the rollout pattern wanted it)
- `LifecycleEventWithArchive` discriminated union helper
- `LifecycleEventRaw` interface (hand-rolled wire shape, predates `LifecycleEventWire`)
- `LifecycleEventEncryptedPayload` interface (the polymorphic blob shape)
- `assertLifecycleEventPayload(raw): asserts raw is LifecycleEventEncryptedPayload` (hand-rolled validator)
- `LifecycleEventPage` interface (matches the pattern of other Page types — keep)

Mobile consumers import `LifecycleEventRaw` / `LifecycleEventEncryptedPayload` from this file; those imports also need migration once canonical types land.

## Scope

1. Audit `LifecycleEventEncryptedFields` in `packages/types/src/entities/lifecycle-event.ts` — confirm whether it's a single keys-union or a per-variant union. The `DistributivePick` pattern used for InnerWorldEntity in `scripts/openapi-wire-parity.type-test.ts` may apply.
2. Add `LifecycleEventEncryptedInput` to `@pluralscape/types` if not present (per-variant Pick, distributed).
3. Add `LifecycleEventEncryptedInputSchema` to `@pluralscape/validation` (Zod discriminated union over `eventType`, one variant per case).
4. Rewrite `lifecycle-event.ts` to consume `LifecycleEventWire`, `LifecycleEventEncryptedInput` directly. Replace `assertLifecycleEventPayload` with `LifecycleEventEncryptedInputSchema.parse(decrypted)`.
5. Migrate mobile consumers — `apps/mobile/src/hooks/use-lifecycle-events.ts`, `apps/mobile/src/data/row-transforms/lifecycle.ts`, persisters — to import canonical types from `@pluralscape/types`.
6. Update SoT manifest entry for LifecycleEvent (currently has `encryptedInput` but no `result` — verify and fix).

## Out of scope

- Cluster 8 OpenAPI G7 reconciliation — see `types-iupb`
- Hardening encrypted-fields union with `Exclude<>` — see `types-x61u`

## Acceptance

- [ ] Zero local types declared in `packages/data/src/transforms/lifecycle-event.ts` (functions + `LifecycleEventPage` only)
- [ ] `assertLifecycleEventPayload` removed; runtime validation via Zod schema parse
- [ ] All mobile consumers of LifecycleEventRaw / LifecycleEventEncryptedPayload migrated to `@pluralscape/types` imports
- [ ] `pnpm types:check-sot` passes
- [ ] CI green

## Cross-references

- Parent: ps-y4tb
- Blocked-by: ps-etbc (PR #562)
- Related: types-x61u (`Exclude<>` hardening for journal-entry/note + distributive Pick for lifecycle-event)

## Summary of Changes

LifecycleEvent now follows the canonical SoT chain:

- `LifecycleEventEncryptedFields` widened to the full per-variant key union (`notes | relatedLifecycleEventId | previousForm | newForm | previousName | newName | entity | entityType`)
- `LifecycleEventEncryptedInput` is the defensively-distributive `Pick<LifecycleEvent, Extract<keyof LifecycleEvent, …>>` so each variant contributes only the keys it owns
- `LIFECYCLE_EVENT_ENCRYPTED_SCHEMAS` (Zod) selects per-variant validation by plaintext `eventType`
- `LifecycleEventResult = EncryptedWire<LifecycleEventServerMetadata>` and `LifecycleEventWire = Serialize<LifecycleEventResult>`
- Local `LifecycleEventEncryptedPayload`, `LifecycleEventRaw`, and `assertLifecycleEventPayload` deleted; mobile consumers migrated to canonical `LifecycleEventWire`
- OpenAPI `PlaintextLifecycleEvent` now distributes across variants (oneOf-style)
- Removed dead `encryptedData === null` defensive branch (the column is `notNull()` in PG and SQLite)

PR: refactor/ps-y4tb-batch2-entity-migrations (commit 96c348e0)
