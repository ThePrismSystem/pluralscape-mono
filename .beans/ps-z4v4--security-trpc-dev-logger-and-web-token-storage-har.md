---
# ps-z4v4
title: "Security: tRPC dev logger and web token storage hardening"
status: todo
type: task
priority: low
created_at: 2026-04-06T00:53:47Z
updated_at: 2026-04-06T00:53:47Z
parent: ps-y621
---

Two medium-severity security items:

1. apps/mobile/src/providers/trpc-provider.tsx:67 — loggerLink({ enabled: () => **DEV** }) logs all tRPC operations in dev mode. If select callbacks throw, error payloads could include partial plaintext. Fix: configure custom log filter excluding query/mutation data.

2. apps/mobile/src/platform/drivers/indexeddb-token-store.ts:22-27 — Web token storage uses IndexedDB plaintext (acknowledged in threat model). Document CSP requirement at app shell level. Consider short-lived tokens + httpOnly refresh cookies when API supports them.

Audit ref: Pass 2 MEDIUM
