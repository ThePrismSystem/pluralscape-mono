---
# client-ymp0
title: Validate encrypted field assertions beyond name-only checks
status: todo
type: task
priority: normal
created_at: 2026-04-14T09:29:32Z
updated_at: 2026-04-14T09:29:32Z
---

AUDIT [DATA-S-M1] assertMemberEncryptedFields only validates name and pronouns. All other fields trusted without validation after decryption. Same in group.ts (name only) and custom-front.ts (object-ness only). Corrupted blob silently produces undefined values.
