---
# api-svsr
title: "M8: Simplify email adapter factory pattern"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T10:31:26Z
parent: api-hvub
---

Object.create + Object.defineProperty factory in ResendEmailAdapter.fromClient() and SmtpEmailAdapter.fromTransport() bypasses constructors unnecessarily. Use constructor-based DI.

## Summary of Changes\n\nReplaced Object.create + Object.defineProperty patterns with private constructor + static factory in both ResendEmailAdapter and SmtpEmailAdapter.
