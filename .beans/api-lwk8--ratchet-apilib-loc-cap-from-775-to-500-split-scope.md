---
# api-lwk8
title: Ratchet api/lib LOC cap from 775 to 500 (split scope-registry.ts)
status: completed
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T12:06:27Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split apps/api/src/lib/scope-registry.ts (currently 754 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 775 to 500. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md

## Summary of Changes

Split apps/api/src/lib/scope-registry.ts (754 LOC) into:

- apps/api/src/lib/scope-registry.ts — interfaces, buildRegistry, SCOPE_REGISTRY export (40 LOC)
- apps/api/src/lib/scope-registry/rest-entries.ts — REST_ENTRIES const (366 LOC)
- apps/api/src/lib/scope-registry/trpc-entries.ts — TRPC_ENTRIES const (353 LOC)

Lowered B8 cap in tooling/eslint-config/loc-rules.js from 775 to 500. All consumers (3 files) keep importing SCOPE_REGISTRY from apps/api/src/lib/scope-registry.js — no test churn.

Verified: pnpm typecheck, pnpm vitest run --project api scope-registry.test.ts, pnpm lint --filter=@pluralscape/api, pnpm lint:loc — all pass.
