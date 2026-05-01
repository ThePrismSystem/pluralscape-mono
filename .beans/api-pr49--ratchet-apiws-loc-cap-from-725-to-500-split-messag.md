---
# api-pr49
title: Ratchet api/ws LOC cap from 725 to 500 (split message-router.ts)
status: todo
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T11:45:33Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split apps/api/src/ws/message-router.ts (currently 719 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 725 to 500. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md
