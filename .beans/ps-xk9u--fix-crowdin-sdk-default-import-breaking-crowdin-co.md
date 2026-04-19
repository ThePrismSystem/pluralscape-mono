---
# ps-xk9u
title: Fix Crowdin SDK default-import breaking crowdin-config CI
status: completed
type: bug
priority: high
created_at: 2026-04-19T01:19:00Z
updated_at: 2026-04-19T01:19:00Z
---

Node 22+ changed ESM-CJS default-import interop: `import X from 'cjs'` resolves to the full module.exports namespace object instead of exports.default, even when \_\_esModule is set. The Crowdin SDK exports Client via both `exports.default` and `exports.Client`, so the default import gives us an object of API classes and `new CrowdinClientCtor(...)` throws 'is not a constructor'.

The bug has been latent — crowdin-config CI was masking it until 30bcd3ab added `set -eo pipefail` (tee exits 0). Now the real failure surfaces.

## Summary of Changes

- scripts/crowdin/client.ts: switch to named import `{ Client as CrowdinClientCtor }`
- scripts/**tests**/crowdin/client.test.ts: regression test verifying createCrowdinClient returns a real Client instance

Known limitation: vitest's bundler synthesizes default exports differently than Node's native ESM, so the vitest test does not reproduce the specific interop quirk — it only catches general `createCrowdinClient` regressions. The tsx-executed crowdin-config workflow is what surfaces the interop issue end-to-end.
