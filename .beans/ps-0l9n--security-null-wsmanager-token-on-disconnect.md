---
# ps-0l9n
title: "Security: null WsManager token on disconnect"
status: todo
type: bug
priority: critical
created_at: 2026-04-06T00:52:27Z
updated_at: 2026-04-06T00:52:27Z
parent: ps-y621
---

Session token (lastToken) and lastSystemId retained in WsManager closure variables after disconnect(). After logout, if a reference survives cleanup, the token remains addressable in memory.

Fix: set lastToken = null and lastSystemId = null in disconnect().

File: apps/mobile/src/connection/ws-manager.ts:62-63,147
Audit ref: Pass 2 HIGH
