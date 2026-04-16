---
# mobile-txcx
title: Implement token refresh with retry for tRPC client
status: todo
type: feature
priority: normal
created_at: 2026-04-02T05:52:30Z
updated_at: 2026-04-16T06:41:46Z
parent: ps-8coo
---

The TRPCProvider currently logs the user out on 401. Implement a proper token refresh flow: intercept 401, attempt refresh using stored refresh token, queue pending requests, retry on success, logout on refresh failure.

## Code Review Findings (PR #355)

The following issues in `apps/mobile/src/providers/trpc-provider.tsx` should be addressed as part of this work:

- [ ] **401 race condition:** `onUnauthorized()` triggers logout but the 401 response is still returned to tRPC, causing error display to race with logout. Consider returning a synthetic response or aborting.
- [ ] **Stale closure:** `onUnauthorized` is captured in `useState` closure on first render, never updated. Works today because the callback reads from a ref internally, but fragile. Use a ref inside the provider.
- [ ] **`getToken()` rejection unhandled:** If secure storage throws (locked device), the error propagates unhandled into `httpBatchLink` headers callback, failing the entire batch opaquely. Add try/catch with fallback.
- [ ] **Network error handling:** If `fetch()` itself throws (offline, DNS failure), no catch exists. Add error handling for network-level failures.
