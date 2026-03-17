---
# api-uii6
title: Nomenclature settings endpoints
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:58Z
updated_at: 2026-03-17T21:41:58Z
parent: api-6fv1
blocked_by:
  - api-o89k
  - api-wq3i
---

GET /systems/:systemId/nomenclature (12 categories). PUT update atomically. Separate table (nomenclatureSettings) keyed by systemId. Validates known presets or custom values. OCC versioned.

## Summary of Changes

- GET/PUT /systems/:id/nomenclature with OCC versioning
- Separate nomenclature_settings table keyed by systemId
- settings.nomenclature-updated audit event
