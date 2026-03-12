---
# db-38it
title: Resolve switches.encryptedData column vs Switch type mismatch
status: completed
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T21:24:17Z
parent: db-gwpb
---

switches table has encryptedData column but Switch type has no encrypted fields. Either remove column or update type. Ref: audit M20

## Summary of Changes\n\nAlready resolved. No `encryptedData` column on switches — the Switch type has no encrypted fields, it's T3 plaintext by design.
