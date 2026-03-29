---
# api-tmuj
title: Simplify email adapter test factories to constructor-based DI
status: completed
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T12:48:11Z
parent: api-kjyg
---

ResendEmailAdapter.fromClient() and SmtpEmailAdapter.fromTransport() use Object.create + Object.defineProperty to bypass constructors. Replace with constructor parameter injection for clarity and reduced fragility.
