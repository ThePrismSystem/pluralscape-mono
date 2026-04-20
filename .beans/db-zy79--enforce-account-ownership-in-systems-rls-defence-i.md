---
# db-zy79
title: Enforce account ownership in systems RLS (defence-in-depth)
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:22:11Z
updated_at: 2026-04-20T09:22:11Z
parent: db-bry7
---

Finding [H1] from audit 2026-04-20. packages/db/src/rls/policies.ts:45-49. Policy only checks id=app.current_system_id; attacker setting app.current_system_id to unowned system gains full access. Fix: id=current_system_id AND account_id=current_account_id.
