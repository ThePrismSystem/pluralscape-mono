---
# ps-92nh
title: "Audit: Mode coverage sweep — reduced-motion"
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:52:03Z
updated_at: 2026-05-17T07:42:03Z
parent: ps-oqs8
blocked_by:
  - ps-nwju
  - ps-divy
  - ps-07l7
  - ps-5fc5
  - ps-9xue
  - ps-7wf6
  - ps-djgs
  - ps-6a3x
  - ps-k8mz
---

## Goal

Audit every Phase 2 screen for reduced-motion coverage per GOVERNANCE.md §3. Reduced-motion preserves layout and gestures but removes or shortens animations.

## Method

1. Walk every HTML mockup under docs/design-system/preview/ produced by Phase 1 + Phase 2.
2. For each animation, classify:
   - **Decorative** (purely aesthetic — remove entirely).
   - **Informational** (signals state change — replace with instant state swap).
   - **Disorienting** (parallax, slide-from-edge, scale — must be neutralized).
3. For every animation that requires a non-trivial reduced-motion variant, create a follow-up bean.

## Required output

- Audit report at docs/superpowers/audits/2026-XX-XX-reduced-motion-sweep.md.
- For each gap: a new bean titled "Reduced-motion: <surface>" parented to the relevant Phase 2 domain epic, blocked-by this audit bean.
- This bean's `## Summary of Changes` lists every spawned bean ID.

## Out of scope

- Redesign of surfaces — gaps spawn beans, not handled inline.
- RN implementation (M11).
