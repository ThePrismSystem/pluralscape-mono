---
# api-4pl2
title: Document webhook secret rotation procedure
status: completed
type: task
priority: normal
created_at: 2026-03-15T21:56:00Z
updated_at: 2026-03-21T10:18:25Z
parent: api-i8ln
---

Finding 10 from STRIDE/OWASP audit. Webhook secrets in Tier 3 are a design limitation. Document the rotation procedure and operational guidelines for webhook secret management.

## Summary of Changes

- Created `docs/adr/027-webhook-secret-rotation.md` documenting:
  - Create-then-archive pattern for secret rotation
  - Operational guidelines (90-day rotation, transition periods, monitoring)
  - Future in-place rotation endpoint design
  - Reference to ADR 025 for security context
