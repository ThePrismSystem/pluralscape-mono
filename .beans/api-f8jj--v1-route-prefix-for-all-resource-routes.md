---
# api-f8jj
title: v1 route prefix for all resource routes
status: completed
type: task
priority: normal
created_at: 2026-03-19T04:52:09Z
updated_at: 2026-03-19T04:54:32Z
parent: api-765x
---

Add /v1/ prefix to all resource routes. Keep GET / and GET /health unversioned.

## Summary of Changes\n\n- Created `apps/api/src/routes/v1.ts` grouping account, auth, and system routes\n- Updated `apps/api/src/index.ts` to mount routes under `/v1`\n- Added integration test `v1-routing.test.ts` verifying versioned and unversioned paths\n- Updated OpenAPI server URL to `http://localhost:3000/v1`\n- Regenerated bundled OpenAPI spec
