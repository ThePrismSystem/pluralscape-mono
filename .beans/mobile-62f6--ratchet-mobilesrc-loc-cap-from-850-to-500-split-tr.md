---
# mobile-62f6
title: Ratchet mobile/src LOC cap from 850 to 500 (split trpc-persister-api.ts)
status: todo
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T11:45:33Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split apps/mobile/src/features/import-sp/trpc-persister-api.ts (currently 824 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 850 to 500. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md
