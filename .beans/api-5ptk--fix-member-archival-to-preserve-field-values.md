---
# api-5ptk
title: Fix member archival to preserve field values
status: todo
type: bug
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

archiveMember permanently deletes field values via tx.delete(fieldValues) instead of archiving them. Restore does not restore photos. Violates read-only preservation contract. Change to archive (set archived:true) instead of delete. Ref: audit S-6.
