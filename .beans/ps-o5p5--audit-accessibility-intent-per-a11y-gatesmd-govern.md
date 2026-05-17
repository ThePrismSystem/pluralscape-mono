---
# ps-o5p5
title: "Audit: Accessibility intent per A11Y_GATES.md + GOVERNANCE §8"
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:52:27Z
updated_at: 2026-05-17T07:42:07Z
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

Audit every Phase 1 + Phase 2 surface for accessibility intent per packages/design-system/docs/A11Y_GATES.md and docs/design-system/GOVERNANCE.md §8 component documentation contract.

## Method

1. Walk every HTML mockup under docs/design-system/preview/.
2. For each interactive element verify:
   - Accessible name (label or aria-label intent documented).
   - Role (button / link / heading / region / etc.).
   - Focus order (tab sequence noted).
   - Hit target size (min 44×44 mobile / 24×24 web per WCAG 2.2).
   - Color is not sole conveyor (icon + text together).
   - Live region usage for async state changes.
3. For each surface, produce a pass/fail row per gate.
4. For every fail, create a follow-up bean tagged with the failing gate.

## Required output

- Audit report at docs/superpowers/audits/2026-XX-XX-accessibility-intent.md.
- Gate matrix: rows = surfaces, columns = A11Y_GATES sections, cells = pass/fail.
- For each fail: a new bean titled "A11y: <surface> — <gate>" parented to the relevant Phase 2 domain epic.
- This bean's `## Summary of Changes` includes the matrix + spawned bean IDs.

## Out of scope

- Automated a11y test wiring (M11+).
- RN implementation (M11).
