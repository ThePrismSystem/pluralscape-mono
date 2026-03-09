---
# types-cp8f
title: Runtime ID and timestamp helpers
status: completed
type: task
priority: normal
created_at: 2026-03-08T23:47:42Z
updated_at: 2026-03-09T01:46:18Z
parent: types-im7i
---

Runtime utility functions deferred from types-av6x (pure types bean). Needed for programmatic ID creation and timestamp generation.

## Scope

- `createId<T extends BrandedId>(prefix: string): T` — generates a prefixed UUID as a branded ID
- `now(): UnixMillis` — returns `Date.now()` as branded UnixMillis
- `toISO(ms: UnixMillis): ISOTimestamp` — converts UnixMillis to branded ISOTimestamp

## Notes

These may belong in a separate `@pluralscape/utils` package or in `@pluralscape/types` as a separate entrypoint (e.g. `@pluralscape/types/runtime`). Decide based on dependency graph — DB/API packages that import types should not need runtime deps if they only need the type definitions.

## Acceptance Criteria

- [x] createId function with prefix support
- [x] now() helper returning UnixMillis
- [x] toISO() conversion helper
- [x] Unit tests with actual runtime assertions
- [x] Decide package location: @pluralscape/types/runtime subpath export

## Summary of Changes

Implemented runtime ID and timestamp helpers as `@pluralscape/types/runtime` subpath export. Added `createId<T>()`, `now()`, and `toISO()` functions with full test coverage. Added `crypto.randomUUID()` global type declaration.
