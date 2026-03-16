---
# types-onob
title: Zod and TypeScript type alignment strategy
status: completed
type: task
priority: high
created_at: 2026-03-09T12:13:29Z
updated_at: 2026-03-16T08:16:30Z
parent: ps-rdqo
---

Decide and document the Zod/TypeScript alignment approach: generate Zod schemas from types, generate types from Zod, or use a shared source. Currently types are standalone (packages/types) and Zod is a dependency of apps/api. Maintaining both manually will cause drift. Record<string, unknown> in 4 extensibility points (jobs, realtime, webhooks, notifications) will need runtime validation.

Source: Architecture Audit 004, Metric 2

## Summary of Changes

- Created ADR 023 documenting Option C (shared validation package with hand-written Zod schemas)
- Scaffolded `packages/validation` with Zod v4, branded type helpers, and auth schemas
- `branded.ts`: `brandedString<B>()` and `brandedNumber<B>()` using `z.custom` to bridge phantom Brand tags
- `auth.ts`: `LoginCredentialsSchema` and `RegistrationInputSchema` with `.readonly()` matching canonical types
- Contract tests: compile-time (`expectTypeOf`) + runtime (`safeParse`) verification for both schemas
- Wired into monorepo: vitest config, pnpm workspace, turbo pipeline (all auto-discovered)
