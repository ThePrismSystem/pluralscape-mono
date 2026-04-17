---
# ps-chwx
title: Add error-path E2E tests for SP import engine
status: in-progress
type: task
priority: normal
created_at: 2026-04-11T03:07:31Z
updated_at: 2026-04-17T06:30:25Z
parent: ps-0enb
---

Add E2E tests covering error scenarios deferred from PR #408 review:

- Malformed/corrupted SP data (invalid JSON, missing required fields)
- Network failures (timeout, connection refused)
- Invalid/expired tokens
- Partial category selection (selectedCategories filtering)
- Avatar mode variations (download vs skip)
- Idempotency tests (running the same import twice)
- Checkpoint resume equivalence assertion (resumed import produces same entity set as full import)

Context: PR #408 added basic structural E2E tests but deferred error-path coverage to keep PR scope manageable. These tests should extend packages/import-sp/src/**tests**/e2e/sp-import.e2e.test.ts.
