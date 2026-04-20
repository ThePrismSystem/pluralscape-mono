---
# db-dpp7
title: audit_log RLS blocks nullified rows after account deletion
status: todo
type: bug
priority: critical
created_at: 2026-04-20T09:21:02Z
updated_at: 2026-04-20T09:21:02Z
parent: db-bry7
---

Finding [C1] from audit 2026-04-20. packages/db/src/rls/policies.ts:65-73, packages/db/src/schema/pg/audit-log.ts:41-45. RLS requires account_id+system_id match but audit_log uses ON DELETE SET NULL — rows become permanently invisible post-deletion. Fix: privileged role exempt from RLS for audit log access, or USING clause that handles NULLs.
