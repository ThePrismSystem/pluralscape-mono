---
# api-g7mc
title: Optimize co-fronting O(n^2) pairwise computation
status: completed
type: task
priority: high
created_at: 2026-03-24T09:24:08Z
updated_at: 2026-03-24T09:38:18Z
parent: ps-4ioj
---

computeCoFrontingBreakdown uses nested loop O(n^2) over memberSessions. With 10K session cap, worst case ~50M iterations. Sort by startTime and use sliding window to skip non-overlapping pairs.
