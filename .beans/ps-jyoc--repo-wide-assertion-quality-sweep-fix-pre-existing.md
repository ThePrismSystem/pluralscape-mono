---
# ps-jyoc
title: "Repo-wide assertion-quality sweep: fix pre-existing toBeDefined() uses"
status: completed
type: task
priority: low
created_at: 2026-04-17T17:42:50Z
updated_at: 2026-04-19T11:09:13Z
parent: ps-0enb
---

PR #464 review item #15 called for expanding the mobile-only assertion-quality guard to repo-wide scope. The expansion surfaced ~317 pre-existing \`.toBeDefined()\` usages across ~105 test files in \`apps/api/**\`, \`packages/**\`, and non-mobile \`apps/\*\*\` paths.

Too large for a single cleanup pass — split out here.

## Todos

- [ ] Move \`apps/mobile/src/**tests**/assertion-quality.test.ts\` → \`tooling/test-utils/src/**tests**/assertion-quality.test.ts\`
- [ ] Expand the pathspec to \`apps/**\` + \`packages/**\` (excluding self)
- [ ] Triage the ~317 surfaced occurrences — most should fit the patterns from the original mobile sweep:
  - React Query hooks → \`expect(result.current.isSuccess).toBe(true)\` inside \`waitFor\` + concrete shape assertions
  - Value presence → \`expect(x).not.toBeNull()\` or concrete equality
  - Genuine \"exists\" coverage → drop the assertion
- [ ] Register \`test-utils\` as a vitest project if needed so the guard runs in CI
- [ ] Verify the guard fails when a new bare \`.toBeDefined()\` is introduced

## Why low priority

The guard's value is preventing _new_ backsliding. Pre-existing occurrences are not correctness bugs — they are weak assertions that pass today. They can be drained opportunistically.

## Context

Follow-up to PR #464 / ps-cpxh Domain 7. Original finding in mobile-otb3.

## Summary of Changes

- Fixed 318 bare `.toBeDefined()` occurrences across 105 test files in `apps/**` and `packages/**`, using the three documented rewrite patterns (React Query hook readiness, value-presence with concrete shape, delete-as-redundant).
- Moved `apps/mobile/src/__tests__/assertion-quality.test.ts` -> `tooling/test-utils/src/__tests__/assertion-quality.test.ts`.
- Expanded the guard's pathspec from `apps/mobile/**` to `apps/**` + `packages/**`.
- Registered `tooling/test-utils` as a vitest project in root `vitest.config.ts` and added a `test` script to its package.json.
- Verified the guard fails when a new bare `.toBeDefined()` is introduced.
