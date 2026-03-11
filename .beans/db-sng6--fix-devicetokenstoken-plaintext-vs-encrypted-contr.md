---
# db-sng6
title: Fix deviceTokens.token plaintext vs encrypted contract
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T22:31:45Z
parent: db-bbzk
---

Canonical type: EncryptedString. Encryption tier map: T1 (encrypted). Schema: plaintext varchar(512)/text. pkBridgeState.pkTokenEncrypted uses encrypted storage — inconsistent. Also: type says lastActiveAt, schema uses lastUsedAt. Ref: audit H5

## Summary of Changes

Changed DeviceToken.token from EncryptedString to string (T3 — server must read push tokens). Renamed lastUsedAt to lastActiveAt in both PG and SQLite schemas to match canonical type. Updated all tests.
