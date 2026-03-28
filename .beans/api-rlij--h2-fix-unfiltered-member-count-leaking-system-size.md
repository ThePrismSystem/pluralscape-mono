---
# api-rlij
title: "H2: Fix unfiltered member count leaking system size"
status: todo
type: bug
priority: critical
created_at: 2026-03-28T21:26:23Z
updated_at: 2026-03-28T21:26:23Z
parent: ps-tkuz
---

**Audit:** M6 audit finding H2 (Security)
**File:** `apps/api/src/services/friend-dashboard.service.ts:244-255`

`queryMemberCount` returns total non-archived member count regardless of bucket visibility. Friends with limited access learn the real system size, violating privacy bucket model.

**Fix:** Either remove `memberCount` from dashboard response, or compute as count of bucket-visible members only.
