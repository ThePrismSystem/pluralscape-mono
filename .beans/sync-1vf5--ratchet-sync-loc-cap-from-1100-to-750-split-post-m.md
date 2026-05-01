---
# sync-1vf5
title: Ratchet sync LOC cap from 1100 to 750 (split post-merge-validator.ts)
status: todo
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T11:45:33Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split packages/sync/src/post-merge-validator.ts (currently 1096 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 1100 to 750. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md
