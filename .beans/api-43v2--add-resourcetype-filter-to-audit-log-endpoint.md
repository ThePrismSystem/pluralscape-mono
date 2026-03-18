---
# api-43v2
title: Add resourceType filter to audit log endpoint
status: completed
type: feature
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T08:12:38Z
parent: api-i2pw
---

Audit log query endpoint only supports event_type filter. Bean/spec describes resourceType filter not implemented. Add to validation schema and route handler. Ref: audit B-2.

## Summary of Changes\n\nAdded resource_type filter to AuditLogQuerySchema and queryAuditLog service. Uses LIKE prefix match on eventType column (e.g. resource_type=member matches member.created, member.updated, etc).
