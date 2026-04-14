---
# api-wdba
title: Add per-system quotas for notes and innerworld entities
status: completed
type: task
priority: high
created_at: 2026-04-14T06:39:45Z
updated_at: 2026-04-14T07:10:17Z
parent: ps-9ujv
---

**Finding 1 (Medium)** — OWASP A04, STRIDE DoS

Notes (`note.service.ts`) and innerworld entities (`innerworld-entity.service.ts`, `innerworld-region.service.ts`, `innerworld-canvas.service.ts`) lack `maxPerSystem` quotas. An authenticated user can create unbounded entities, exhausting DB/sync storage.

**Fix:** Add quotas following the existing `maxPerSystem` pattern:

- Notes: 10,000/system
- Innerworld entities: 500/system
- Innerworld regions: 100/system
- Innerworld canvases: 50/system

Reference: security/260414-0126-stride-owasp-full-audit/findings.md#finding-1

## Summary of Changes

Added per-system quotas for all unquoted entity types:

- Notes: 5,000/system (note.service.ts)
- Innerworld entities: 500/system (innerworld-entity.service.ts)
- Innerworld regions: 100/system (innerworld-region.service.ts)
- Innerworld canvases: 50/system (innerworld-canvas.service.ts, INSERT path only)

Pattern: SELECT FOR UPDATE on system row + count non-archived + reject 429 QUOTA_EXCEEDED.
