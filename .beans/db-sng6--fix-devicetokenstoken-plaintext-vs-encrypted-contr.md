---
# db-sng6
title: Fix deviceTokens.token plaintext vs encrypted contract
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

Canonical type: EncryptedString. Encryption tier map: T1 (encrypted). Schema: plaintext varchar(512)/text. pkBridgeState.pkTokenEncrypted uses encrypted storage — inconsistent. Also: type says lastActiveAt, schema uses lastUsedAt. Ref: audit H5
