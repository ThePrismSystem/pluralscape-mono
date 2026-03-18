---
# api-dyhz
title: Fix HIGH audit findings from API core audit 013
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:33:12Z
updated_at: 2026-03-18T15:58:30Z
---

Implement all 5 HIGH-severity fixes from the API core comprehensive audit (013): missing blob list rate limit, pagination limit standardization, inline JSON body parsing extraction, parallel reorder updates, and relationship service test coverage.

## Summary of Changes\n\nAll 5 HIGH-severity findings from audit 013 addressed:\n\n- H1: Added missing rate limit to blob list endpoint\n- H2: Standardized pagination limit parsing (fixed unbounded session limit bug)\n- H3: Replaced 22 inline JSON body parsing blocks with parseJsonBody helper\n- H4+H5: Parallelized group and photo reorder updates within transactions\n- H6: Added 7 tests improving relationship service coverage
