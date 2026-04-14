---
# api-wdba
title: Add per-system quotas for notes and innerworld entities
status: todo
type: task
priority: high
created_at: 2026-04-14T06:39:45Z
updated_at: 2026-04-14T06:39:45Z
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
