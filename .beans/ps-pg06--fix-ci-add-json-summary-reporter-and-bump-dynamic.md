---
# ps-pg06
title: "Fix CI: add json-summary reporter and bump dynamic-badges to v1.8.0"
status: completed
type: bug
priority: normal
created_at: 2026-04-06T13:19:53Z
updated_at: 2026-04-06T13:20:14Z
---

CI fails on extract coverage data step because coverage-summary.json is missing (json-summary reporter not configured). Also bump schneegans/dynamic-badges-action from v1.7.0 to v1.8.0.

## Summary of Changes\n\n- Added `json-summary` to vitest coverage reporters so `coverage/coverage-summary.json` is generated for the CI badge step\n- Bumped `schneegans/dynamic-badges-action` from v1.7.0 to v1.8.0 (both coverage and E2E badge steps)
