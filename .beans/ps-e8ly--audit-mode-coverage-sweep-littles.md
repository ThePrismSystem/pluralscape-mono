---
# ps-e8ly
title: "Audit: Mode coverage sweep — littles"
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:52:03Z
updated_at: 2026-05-17T07:42:04Z
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

Audit every Phase 2 screen for Littles Safe Mode coverage per GOVERNANCE.md §3. Littles mode is a simplified UI for littles: bigger touch targets, simpler copy register, hidden destructive actions, restricted navigation.

## Method

1. Walk every HTML mockup under docs/design-system/preview/ produced by Phase 1 + Phase 2.
2. For each surface, classify:
   - **Hidden in littles mode** (e.g., API keys, webhooks, data import/export, account deletion — gated).
   - **Simplified in littles mode** (smaller-vocabulary copy, single-action layout).
   - **Identical** (already passes).
3. For every simplified or hidden surface, create a follow-up bean.
4. Document the gate list (which surfaces vanish entirely) as a deliverable.

## Required output

- Audit report at docs/superpowers/audits/2026-XX-XX-littles-mode-sweep.md.
- For each gap: a new bean titled "Littles mode: <surface>" parented to the relevant Phase 2 domain epic, blocked-by this audit bean.
- This bean's `## Summary of Changes` includes the full gate list (surfaces hidden in littles mode) plus every spawned bean ID.

## Out of scope

- Mode-switching mechanics (lives in onboarding + settings beans).
- RN implementation (M11).
