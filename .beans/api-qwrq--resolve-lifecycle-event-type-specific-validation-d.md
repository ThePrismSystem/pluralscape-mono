---
# api-qwrq
title: Resolve lifecycle event type-specific validation design
status: todo
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

Bean api-dwou describes per-event-type Zod schemas but all type-specific data is in encryptedData (E2E encrypted). Server cannot validate. Design decision needed: add plaintext reference IDs or scope to client-side validation. Ref: audit B-1.
