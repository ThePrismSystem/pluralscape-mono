---
# crypto-z2eg
title: Harden Argon2id params / add context-specific profiles
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:50Z
updated_at: 2026-04-20T09:22:50Z
parent: crypto-cpir
---

Finding [H2] from audit 2026-04-20. packages/crypto/src/crypto.constants.ts:72-75. PWHASH_OPSLIMIT_UNIFIED=4 with 64 MiB memory — meets OWASP threshold but applied to ALL contexts (PIN, transfer key, master key). SENSITIVE constant at 1 GiB exists but unused. Verify mobile memory limits; consider separate profiles for transfer vs master-key derivation.
