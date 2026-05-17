---
# ps-9bdx
title: "Audit: Mode coverage sweep — static"
status: todo
type: task
created_at: 2026-05-17T06:52:03Z
updated_at: 2026-05-17T06:52:03Z
parent: ps-oqs8
---

## Goal

Audit every Phase 2 screen for static-mode coverage per GOVERNANCE.md §3. Static mode removes all animation, gestures, transitions — everything is tap-only and instant.

## Method

1. Walk every HTML mockup under docs/design-system/preview/ produced by Phase 1 + Phase 2.
2. For each surface, identify any animation, gesture, or transition (slide-in, fade, spring, drag, swipe, hold).
3. Categorize each:
   - **Already covered** (mockup notes static-mode behavior).
   - **Trivially derived** (no design needed — animation simply removed).
   - **Needs static variant** (gesture must be replaced — e.g., bottom-sheet drag becomes full-screen modal; hold-to-confirm becomes typed-match).
4. For every "needs static variant" gap, create a follow-up bean blocked by this audit.

## Required output

- Audit report at docs/superpowers/audits/2026-XX-XX-static-mode-sweep.md (local-only — folder is gitignored).
- For each gap: a new bean titled "Static mode: <surface>" parented to the relevant Phase 2 domain epic, blocked-by this audit bean.
- This bean's `## Summary of Changes` lists every spawned bean ID.

## Out of scope

- Redesign of surfaces — gaps spawn beans, not handled inline.
- RN implementation (M11).
