---
# api-dybz
title: Add permanent DELETE endpoint for member photos
status: completed
type: feature
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:57:44Z
parent: api-i2pw
---

Member photos have archive/restore but no permanent delete. Add DELETE /systems/:systemId/members/:memberId/photos/:photoId. Ref: audit F-2.

## Summary of Changes

- Added `member-photo.deleted` audit event type
- Added `deleteMemberPhoto` service function (verify exists, audit, hard delete)
- Created `routes/members/photos/delete.ts` route handler
- Registered in `routes/members/photos/index.ts`
