---
# ps-3m01
title: Design ProgressBar and ProgressRing primitives
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:27:52Z
updated_at: 2026-05-17T08:50:22Z
parent: ps-udt1
---

## Goal

Design the ProgressBar (linear) and ProgressRing (circular) primitives together — they share semantics (determinate / indeterminate) and tokens. Used for import jobs, key rotation, blob upload, fronting-report generation.

## Required output

- [ ] `docs/design-system/preview/components-progress.html` showing ProgressBar + ProgressRing with variants (determinate, indeterminate, success, error) and sizes (sm, md, lg)
- [ ] Spec doc per SKILL.md §8 (one doc covering both primitives with shared rules)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/motion.json` (animation), `tokens/radii.json`
- Reference: GOVERNANCE.md §3 (reduced-motion: spinner replaces indeterminate animation; static: bar with no transition)

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)

## Re-audit disposition (2026-05-17)

Already designed in `components-display.html:359-376` — determinate bar
(65% width example), indeterminate bar, and ring (44px, dashoffset for
65%) rendered with usage notes (determinate for import progress / key
rotation, indeterminate for export queued, ring inline with status text).

Updated scope: extract into `components-progress.html`. Add: small/medium/
large size tokens, stalled/error variants, the 8 acceptance states, 4 mode
variants (low-sensory removes any glow/pulse; high-contrast promotes the
fill color), 7-section doc.

Extraction task.
