---
# ps-00b4
title: Design ConfirmGesture primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:27:36Z
updated_at: 2026-05-17T08:50:23Z
parent: ps-udt1
---

## Goal

Design the ConfirmGesture primitive: hold-to-confirm circular-progress affordance for irreversible actions in distress contexts (e.g., the in-the-moment "end fronting now" action in Littles-safe mode). Provides physical friction without dialog overhead.

## Required output

- [ ] `docs/design-system/preview/components-confirm-gesture.html` showing variants (small/medium/large), progress states (0 / 25 / 50 / 75 / 100%), and the released-too-early reset state
- [ ] Spec doc per SKILL.md §8, with explicit note: must remain accessible via keyboard equivalent (long-press is touch-only)

## Tokens / references

- Tokens: `tokens/motion.json`, `tokens/colors.json`
- Reference: GOVERNANCE.md §3 (reduced-motion mode disables animation; provide tap-twice fallback)

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)

## Re-audit disposition (2026-05-17)

Already designed in `components-feedback.html:336-377`. Hold-to-confirm
with a 1.2s ring fill, 3 states rendered (idle, holding-0.7s, confirmed).
Used for irreversible actions in distress contexts (panic deletion,
immediate sign-out everywhere) where a tap could be accidental. Releases
early → cancels.

Updated scope: extract into `components-confirm-gesture.html`. Add: the
8 acceptance states (focus-visible matters here for keyboard users — Space
holds, releasing within 1.2s cancels), 4 mode variants (littles likely
disables this entirely; high-contrast doubles the ring; low-sensory
removes the pulse), 7-section doc.

Extraction task.
