---
# crypto-fpgm
title: Two-layer MasterKey architecture (KEK/DEK)
status: completed
type: task
priority: high
created_at: 2026-03-15T07:31:26Z
updated_at: 2026-03-15T07:53:36Z
parent: crypto-89v7
---

Introduce persistent random MasterKey wrapped by password-derived key (KEK/DEK pattern). Prerequisite for password reset that preserves sessions. Adds encryptedMasterKey column to accounts, new master-key-wrap.ts with generateMasterKey/wrapMasterKey/unwrapMasterKey/derivePasswordKey.

## Summary of Changes\n\nImplemented two-layer KEK/DEK master key architecture:\n- New `master-key-wrap.ts`: generateMasterKey, derivePasswordKey, wrapMasterKey, unwrapMasterKey\n- Added encryptedMasterKey column to accounts table (PG + SQLite)\n- Updated Account type interface\n- Full test coverage in master-key-wrap.test.ts
