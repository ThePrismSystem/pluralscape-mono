---
# db-dpp7
title: audit_log RLS blocks nullified rows after account deletion
status: completed
type: bug
priority: critical
created_at: 2026-04-20T09:21:02Z
updated_at: 2026-04-20T21:35:11Z
parent: db-bry7
---

Finding [C1] from audit 2026-04-20. packages/db/src/rls/policies.ts:65-73, packages/db/src/schema/pg/audit-log.ts:41-45. RLS requires account_id+system_id match but audit_log uses ON DELETE SET NULL — rows become permanently invisible post-deletion. Fix: privileged role exempt from RLS for audit log access, or USING clause that handles NULLs.

## Summary of Changes

audit_log RLS USING clause now explicitly filters rows with NULL account_id or system_id. Previously rows nullified by ON DELETE SET NULL remained in the table but the `NULL = <anything>` comparison evaluated to NULL (not TRUE), making them permanently invisible to every tenant but without documentation of the intent. The policy is now:

    USING (account_id IS NOT NULL AND system_id IS NOT NULL
           AND account_id = current_account_id()
           AND system_id = current_system_id())
    WITH CHECK (account_id = current_account_id() AND system_id = current_system_id())

Admin/forensic access to nullified rows is available via a role with BYPASSRLS (superuser or a dedicated audit_reader). Integration test covers three paths: live tenant read, invisible-from-tenant of nulled rows, and still-present-on-disk via role reset.
