---
# api-dpg2
title: Add mutual exclusion CHECK for encryptedData vs payloadData
status: todo
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T07:13:17Z
parent: api-kjyg
---

packages/db/src/schema/pg/webhooks.ts:86-87 has both encryptedData and payloadData columns with no CHECK preventing both populated or both null. Add CHECK like (encrypted_data IS NULL) != (payload_data IS NULL).
