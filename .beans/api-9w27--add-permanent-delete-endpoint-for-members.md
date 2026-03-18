---
# api-9w27
title: Add permanent DELETE endpoint for members
status: completed
type: feature
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:57:43Z
parent: api-i2pw
---

Members have archive/restore but no permanent delete. API spec section 9 describes deletion with HAS_DEPENDENTS 409 response. Add DELETE /systems/:systemId/members/:memberId. Ref: audit F-1.

## Summary of Changes

- Added `member.deleted` audit event type
- Added `deleteMember` service function checking 10 FK tables for dependents
- Returns 409 HAS_DEPENDENTS with typed dependents array
- Created `routes/members/delete.ts` route handler
- Registered in `routes/members/index.ts`
