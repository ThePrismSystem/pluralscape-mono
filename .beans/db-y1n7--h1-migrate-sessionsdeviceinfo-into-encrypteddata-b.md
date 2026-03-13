---
# db-y1n7
title: "H1: migrate sessions.deviceInfo into encryptedData blob"
status: completed
type: task
created_at: 2026-03-13T05:48:55Z
updated_at: 2026-03-13T05:48:55Z
parent: db-hcgk
---

Remove deviceInfo JSONB column from PG and SQLite session schemas. DeviceInfo is now inside the existing T1-encrypted encryptedData blob.
