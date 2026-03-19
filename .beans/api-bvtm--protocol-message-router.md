---
# api-bvtm
title: Protocol message router
status: todo
type: task
priority: critical
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T11:39:40Z
parent: api-fh4u
---

Dispatch `ClientMessage` types to handler functions. Schema validation using Zod (MALFORMED_MESSAGE on failure). Route all 9 client message types defined in protocol spec.

## Acceptance Criteria

- Unknown message type → MALFORMED_MESSAGE error response
- Schema validation failure → MALFORMED_MESSAGE with detail
- Each of the 9 known client message types dispatches to correct handler
- Handler dispatch is exhaustive (compile-time enforcement via switch + never default)
- Unit tests for routing each message type and malformed input
