---
# api-vc80
title: Validate email format before hashing/encrypting
status: todo
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T07:13:17Z
parent: api-kjyg
---

email-hash.ts:39 and email-encrypt.ts:54 normalize with toLowerCase().trim() but never validate syntactic validity. Malformed inputs (empty strings, very long strings) are silently processed.
