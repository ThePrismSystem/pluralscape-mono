---
# ps-oqs8
title: M10 audits
status: todo
type: epic
created_at: 2026-05-17T05:48:31Z
updated_at: 2026-05-17T05:48:31Z
parent: ps-9cca
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

Phase 3 epic for M10 horizontal coverage sweeps and audits, run after all Phase 2 domain epics complete.

Spec: docs/superpowers/specs/2026-05-16-m10-bean-buildout-design.md

## Beans under this epic (7 audit beans)

1. Mode coverage sweep — static
2. Mode coverage sweep — reduced-motion
3. Mode coverage sweep — high-contrast
4. Mode coverage sweep — littles
5. State coverage audit — empty / loading / error across every list and detail screen
6. Accessibility intent audit per packages/design-system/docs/A11Y_GATES.md and docs/design-system/SKILL.md §8.3
7. Screen → router parity audit against the 41 tRPC routers in apps/api/src/trpc/routers/

Each audit follows the audit body template from the spec.

## Out of scope

- Redesign of failing surfaces — gaps spawn new beans, not handled inside the audit.
- RN code (M11).
