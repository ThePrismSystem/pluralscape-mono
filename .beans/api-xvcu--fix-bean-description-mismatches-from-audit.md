---
# api-xvcu
title: Fix bean description mismatches from audit
status: completed
type: task
priority: deferred
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T08:12:39Z
parent: api-i2pw
---

api-uixu: S3 cleanup job missing. api-yp99: wrong constant in UpdateSystemBodySchema. api-swt5: bean summary doesn't match implementation. Update descriptions to match reality. Ref: audit B-3, B-4, B-5.

## Summary of Changes\n\nFixed UpdateSystemBodySchema to use MAX_ENCRYPTED_SYSTEM_DATA_SIZE (131K) instead of MAX_ENCRYPTED_DATA_SIZE (87K). Updated system service to use matching byte limit. Updated api-uixu, api-yp99, and api-swt5 bean bodies with audit notes.
