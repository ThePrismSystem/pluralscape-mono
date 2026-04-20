---
# db-eigy
title: Add friend-side read policy for key_grants
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:11Z
updated_at: 2026-04-20T09:22:11Z
parent: db-bry7
---

Finding [H2] from audit 2026-04-20. packages/db/src/schema/pg/privacy.ts:77-103, packages/db/src/rls/policies.ts:229. Compromised system context can enumerate all key grants including encryptedKey. Friend cannot read own received grants without originating system ID. Document intent, and add friend-side read path.
