---
# ps-kyu9
title: "Performance: base64 hot path and query optimization"
status: todo
type: task
priority: low
created_at: 2026-04-16T06:58:45Z
updated_at: 2026-04-16T06:58:45Z
parent: ps-0enb
---

Low-severity performance findings from comprehensive audit.

## Findings

- [ ] [CLIENT-P-M1] api-client uint8ArrayToBase64 uses character-by-character string concatenation
- [ ] [QUEUE-P-L1] dequeue with type filter inspects up to 20 jobs and moves non-matches
- [ ] [CLIENT-TC-L1] No test covers async getToken() path (returns Promise)
