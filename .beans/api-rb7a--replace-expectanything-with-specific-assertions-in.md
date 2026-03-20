---
# api-rb7a
title: Replace expect.anything() with specific assertions in route tests
status: completed
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-20T18:58:59Z
parent: api-765x
---

L9: Strengthen test assertions by replacing expect.anything() with specific value checks.

## Acceptance Criteria

- All expect.anything() in route tests replaced with specific value matchers
- Use expect.stringMatching(), exact values, or structural matchers as appropriate
- No false positives: tests should fail if values change unexpectedly

## Summary of Changes

Implemented as part of feat/api-hardening-audit-013-remaining.
