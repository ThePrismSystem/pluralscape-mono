---
# db-zy79
title: Enforce account ownership in systems RLS (defence-in-depth)
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:22:11Z
updated_at: 2026-04-20T21:35:17Z
parent: db-bry7
---

Finding [H1] from audit 2026-04-20. packages/db/src/rls/policies.ts:45-49. Policy only checks id=app.current_system_id; attacker setting app.current_system_id to unowned system gains full access. Fix: id=current_system_id AND account_id=current_account_id.

## Summary of Changes

systems RLS policy now combines id = current_system_id() AND account_id = current_account_id() in both USING and WITH CHECK clauses. A session whose system_id GUC is set to another tenant's system cannot read or write that row just because it holds the UUID — the account_id predicate gates it. Added a new scope type `systems-pk` and helper systemsPkRlsPolicy() to keep the special case explicit. Integration test covers positive (owner + matching system), negative (system GUC pointing at a foreign tenant returns zero rows), fail-closed (either GUC unset), and WITH CHECK blocking cross-account UPDATE.
