---
# db-eigy
title: Add friend-side read policy for key_grants
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:11Z
updated_at: 2026-04-20T21:35:23Z
parent: db-bry7
---

Finding [H2] from audit 2026-04-20. packages/db/src/schema/pg/privacy.ts:77-103, packages/db/src/rls/policies.ts:229. Compromised system context can enumerate all key grants including encryptedKey. Friend cannot read own received grants without originating system ID. Document intent, and add friend-side read path.

## Summary of Changes

key_grants RLS now has two SELECT paths: `key_grants_owner_read` (system_id = current_system_id()) for the issuing system, and `key_grants_friend_read` (friend_account_id = current_account_id()) for the recipient friend. Writes (INSERT/UPDATE/DELETE) remain tied to the originating system via per-operation policies. Added scope type `key-grants` and keyGrantsRlsPolicy() helper returning the 5-policy array. Integration tests cover: owner read, friend read without system context, non-recipient blocked, friend cannot bypass write restriction without system context.
