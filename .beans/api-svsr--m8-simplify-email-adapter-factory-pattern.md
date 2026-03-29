---
# api-svsr
title: 'M8: Simplify email adapter factory pattern'
status: todo
type: task
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T09:52:48Z
parent: api-hvub
---

Object.create + Object.defineProperty factory in ResendEmailAdapter.fromClient() and SmtpEmailAdapter.fromTransport() bypasses constructors unnecessarily. Use constructor-based DI.
