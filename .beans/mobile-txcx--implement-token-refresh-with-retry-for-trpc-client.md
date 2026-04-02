---
# mobile-txcx
title: Implement token refresh with retry for tRPC client
status: todo
type: feature
created_at: 2026-04-02T05:52:30Z
updated_at: 2026-04-02T05:52:30Z
---

The TRPCProvider currently logs the user out on 401. Implement a proper token refresh flow: intercept 401, attempt refresh using stored refresh token, queue pending requests, retry on success, logout on refresh failure.
