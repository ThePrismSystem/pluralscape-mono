---
# db-38it
title: Resolve switches.encryptedData column vs Switch type mismatch
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:39:44Z
parent: db-gwpb
---

switches table has encryptedData column but Switch type has no encrypted fields. Either remove column or update type. Ref: audit M20
