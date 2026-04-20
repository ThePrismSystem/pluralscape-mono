---
# ps-n2dd
title: "PR #529 audit follow-up fixes"
status: completed
type: task
priority: high
created_at: 2026-04-20T20:39:16Z
updated_at: 2026-04-20T21:00:03Z
---

Fix two critical regressions in query-invalidator plus \_layout error boundary, config URL parsing, expo-constants types, and test mock cleanup. See PR #529 review.

## Summary of Changes

Five commits on `chore/audit-m9-mobile-followup` (branched from `origin/chore/audit-m9-mobile`):

1. **fix(mobile): match search invalidation against query-scope vocabulary** — Event scope (`"self"|"friend"`) and query scope (`"self"|"friends"|"all"`) are different unions. The previous predicate equality check never matched the default `"all"` query scope, leaving every default search stale. Replaced with a `queryScopesToInvalidate` mapping.

2. **fix(mobile): fall back to broad invalidation for compound detail keys** — `messages` is hotPath but `useMessage` keys details as `[table, channelId, messageId]`. Hot-path narrowing skipped them, and entity events couldn't prefix-match either. Added `compoundDetailKey` flag to `EntityTableDef`, set on the `message` row; invalidator falls back to broad table invalidation when set.

3. **fix(mobile): guard module-init errors with try/catch in \_layout** — Hoisted `createChainedBackend` called `getApiBaseUrl()` at module import. A throw there preempted React mount. Wrapped in try/catch; RootLayout surfaces the failure via the existing ErrorScreen boundary.

4. **refactor(mobile): parse URL for scheme dispatch in config.ts** — Replaced fragile `startsWith("https://")/startsWith("http://")` chain with `new URL(...).protocol` switch. Catches `"HTTPS://..."` (case), `"http:example.com"` (malformed), `"http://[::1]:3000"` (IPv6 loopback). `getWsUrl` is now a pure scheme transform — `getApiBaseUrl` is the single validation choke point.

5. **chore(mobile): drop redundant lastOptions map in secure-store test mock** — The keyed `lastOptions` map duplicated what `lastOptionsByMethod` already captured. Removed both map and `__lastOptions` accessor; migrated the one caller.

**NOT actioned** from the plan:

- **Suggestion 2 (expo-constants extras type augmentation)** — Upstream `{ [k: string]: any }` index signature in `@expo/config-types` wins the intersection, so module augmentation cannot actually narrow the type. Kept the original `const configured: unknown = ...` annotation (strictly widens `any` to `unknown`, forces the existing `typeof` guard — strictly MORE type-safe than dropping the cast).
- **Suggestion 4 (eas.json preview DNS)** — out-of-code infra verification, noted in PR body.
- **Follow-up bean: reshape `useMessage` key to `[table, messageId]`** — deferred per plan.

## Verification

- `pnpm typecheck` — clean across 21 packages
- `pnpm lint` — clean across 17 packages
- `pnpm vitest run --project mobile` — 1354/1354 pass
- `pnpm vitest run --project sync` — 912/912 pass

New test counts:

- `query-invalidator.test.ts`: +5 tests (3 scope cases, 2 compoundDetailKey cases)
- `_layout.test.tsx`: +2 tests (module-init error, backend hoisting invariant)
- `config.test.ts`: +3 tests (case-insensitive https, malformed `http:example.com`, IPv6 loopback)
