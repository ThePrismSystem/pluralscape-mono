---
# db-cvfk
title: Evaluate blobMetadata plaintext metadata leakage
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T08:28:12Z
parent: db-2nr7
---

mimeType, purpose, sizeBytes together fingerprint content types for each system. Consider whether these need encryption or are acceptable metadata. Ref: audit M13

## Summary of Changes\n\nAccepted as T3 with rationale documented in the tier map. The server must read `mimeType` (Content-Type headers), `purpose` (quota limits), and `sizeBytes` (quota enforcement). Encrypting these would require trusting client-reported values.
