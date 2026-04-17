---
# api-zhyw
title: Flaky shutdown.test.ts EnvironmentTeardownError on email module imports
status: todo
type: bug
priority: normal
created_at: 2026-04-17T04:01:04Z
updated_at: 2026-04-17T04:01:04Z
---

vitest unit run `pnpm test:unit` intermittently fails with exit 1 due to an unhandled rejection during environment teardown:

```
EnvironmentTeardownError: Cannot load '/@fs/home/theprismsystem/git/pluralscape-mono/packages/email/src/errors.ts'
imported from /home/theprismsystem/git/pluralscape-mono/packages/email/src/index.ts after the environment was torn down.
- packages/email/src/errors.ts
- packages/email/src/index.ts
- apps/api/src/index.ts
- apps/api/src/__tests__/lib/shutdown.test.ts
```

Tests pass (12198 passed | 1 skipped) but the unhandled rejection causes process exit 1.

Re-running passes cleanly. Flaky teardown — likely a race between the test's shutdown sequence and the email module's lazy imports.

## Repro

- Run `pnpm test:unit` repeatedly. Triggers in roughly 1 of 3 runs locally.

## Suggested investigation

- Audit `apps/api/src/__tests__/lib/shutdown.test.ts` for missing `await` on the shutdown sequence.
- Check whether `packages/email/src/index.ts` does dynamic imports of `./errors.ts` that race with vitest's environment teardown.
- May need to await all in-flight email module imports before signalling shutdown.

## Discovered during

PR #461 (mobile-shr0 phase 2). Pre-existing on main, unrelated to that PR's scope.
