---
# api-vnec
title: Consolidate blob validation into single module
status: todo
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

Three implementations of encrypted blob validation: encrypted-blob.ts, validate-encrypted-blob.ts, and inline in member.service.ts. Also duplicate encryptedBlobToBase64 in crypto-helpers.ts and encrypted-blob.ts. Consolidate into encrypted-blob.ts, remove duplicates. Ref: audit P-7, P-8.
