---
# ps-z4v4
title: "Security: tRPC dev logger and web token storage hardening"
status: completed
type: task
priority: low
created_at: 2026-04-06T00:53:47Z
updated_at: 2026-04-06T09:45:38Z
parent: ps-y621
---

Two medium-severity security items:

1. apps/mobile/src/providers/trpc-provider.tsx:67 — loggerLink({ enabled: () => **DEV** }) logs all tRPC operations in dev mode. If select callbacks throw, error payloads could include partial plaintext. Fix: configure custom log filter excluding query/mutation data.

2. ~~apps/mobile/src/platform/drivers/indexeddb-token-store.ts:22-27 — Web token storage uses IndexedDB plaintext~~ **FIXED** — JSDoc threat model comment now documents plaintext storage, XSS risk, and httpOnly cookie alternative.

Audit ref: Pass 2 MEDIUM

## Summary of Changes

1. Restricted loggerLink enabled callback to only fire on error responses (direction=down + error in result).
   Item 2 (CSP documentation) was already fixed.
