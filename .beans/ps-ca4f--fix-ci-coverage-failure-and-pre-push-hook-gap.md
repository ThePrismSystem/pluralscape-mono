---
# ps-ca4f
title: Fix CI coverage failure and pre-push hook gap
status: completed
type: bug
priority: critical
created_at: 2026-03-09T05:07:40Z
updated_at: 2026-04-16T07:29:40Z
parent: ps-vtws
---

CI fails on unit-tests job because global coverage (73.75% lines) is below 80% threshold. Root causes: type-only files at 0%, untested RN adapter, minor gaps in wasm-adapter and sodium init error path. Pre-push hook also doesn't run tests.

- [x] Exclude type-only files from coverage in vitest.config.ts
- [x] Add RN adapter tests via libsodium-wrappers mock
- [x] Add wasm-adapter unit tests (idempotent init, not-ready error)
- [x] Add sodium failed-init error path test
- [x] Add pnpm test:unit:coverage to pre-push hook
- [x] Create follow-up bean for RN environment validation (crypto-jz77)

## Summary of Changes

- Excluded 15 type-only files from v8 coverage in vitest.config.ts
- Added 25 tests for ReactNativeSodiumAdapter via WASM libsodium mock
- Added 2 tests for WasmSodiumAdapter (idempotent init, not-ready error)
- Added 1 test for sodium.ts failed-init error path
- Added pnpm test:unit:coverage to pre-push hook
- Coverage now 96.56% lines (was 73.75%), well above 80% threshold
