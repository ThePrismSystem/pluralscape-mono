---
# api-rj0w
title: "L8: Add CHECK constraint for encryptedData/payloadData mutual exclusion"
status: completed
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:31:26Z
parent: api-hvub
---

Both encryptedData and payloadData columns have no mutual-exclusion CHECK constraint in the schema.

## Summary of Changes\n\nAdded CHECK constraint requiring encrypted_data or payload_data to be non-null.
