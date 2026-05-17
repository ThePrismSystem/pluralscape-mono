---
# ps-a46t
title: "Audit: Mode coverage sweep — high-contrast"
status: todo
type: task
created_at: 2026-05-17T06:52:03Z
updated_at: 2026-05-17T06:52:03Z
parent: ps-oqs8
---

## Goal

Audit every Phase 2 screen for high-contrast mode coverage per GOVERNANCE.md §3 and packages/design-system/docs/A11Y_GATES.md contrast requirements.

## Method

1. Walk every HTML mockup under docs/design-system/preview/ produced by Phase 1 + Phase 2.
2. Run contrast checks on each token-pair used (text on background, icon on background, focus ring on background).
3. For each surface, classify:
   - **Passes high-contrast at default tokens** (no work).
   - **Passes via high-contrast token theme** (covered by theme swap).
   - **Needs surface-specific override** (e.g., subtle dividers must become solid lines; tier badges need different hue mapping).
4. For every surface needing an override, create a follow-up bean.

## Required output

- Audit report at docs/superpowers/audits/2026-XX-XX-high-contrast-sweep.md.
- For each gap: a new bean titled "High-contrast: <surface>" parented to the relevant Phase 2 domain epic, blocked-by this audit bean.
- This bean's `## Summary of Changes` lists every spawned bean ID and a contrast-ratio summary table.

## Out of scope

- Token-theme work (lives in packages/design-system — already in scope for design system).
- RN implementation (M11).
