---
# types-onob
title: Zod and TypeScript type alignment strategy
status: todo
type: task
priority: high
created_at: 2026-03-09T12:13:29Z
updated_at: 2026-03-09T12:13:29Z
parent: ps-rdqo
---

Decide and document the Zod/TypeScript alignment approach: generate Zod schemas from types, generate types from Zod, or use a shared source. Currently types are standalone (packages/types) and Zod is a dependency of apps/api. Maintaining both manually will cause drift. Record<string, unknown> in 4 extensibility points (jobs, realtime, webhooks, notifications) will need runtime validation.

Source: Architecture Audit 004, Metric 2
