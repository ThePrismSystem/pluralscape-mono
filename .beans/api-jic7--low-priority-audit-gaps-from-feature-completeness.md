---
# api-jic7
title: Low-priority audit gaps from feature completeness audit round 2
status: todo
type: task
priority: normal
created_at: 2026-03-30T06:58:15Z
updated_at: 2026-03-30T06:58:15Z
parent: api-e7gt
---

Consolidation of 7 low-severity gaps from round 2 audit:

- [ ] Photo list lacks cursor pagination (returns simple array)
- [ ] Entity links have no update endpoint (delete+recreate pattern)
- [ ] Entity associations have no update endpoint (delete+recreate pattern)
- [ ] Field value lists lack filtering (no filter by type/definition)
- [ ] Fronting reports missing update and archive/restore endpoints
- [ ] Fronting session list missing end-time range filter (endFrom/endUntil)
- [ ] WebSocket heartbeat not explicit (no configurable ping/pong)
