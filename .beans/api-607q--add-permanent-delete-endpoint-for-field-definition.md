---
# api-607q
title: Add permanent DELETE endpoint for field definitions
status: completed
type: feature
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:57:46Z
parent: api-i2pw
---

Field definitions have archive/restore but no permanent delete. Add DELETE /systems/:systemId/fields/:fieldId with dependent-value guards. Ref: audit F-5.

## Summary of Changes

- Added `field-definition.deleted` audit event type
- Added `deleteFieldDefinition` service function with fieldValues dependent check
- Returns 409 HAS_DEPENDENTS if field values exist
- Created `routes/fields/delete.ts` route handler
- Registered in `routes/fields/index.ts`
