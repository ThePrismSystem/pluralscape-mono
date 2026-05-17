---
# ps-bydy
title: Design DestructiveConfirmDialog primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:27:31Z
updated_at: 2026-05-17T08:50:22Z
parent: ps-udt1
---

## Goal

Design the DestructiveConfirmDialog primitive: typed-phrase confirmation extending the base Dialog. Required for the Critical tier of destructive actions per GOVERNANCE.md §6 — account purge, recovery-key regenerate, system delete, friend block, snapshot delete.

## Required output

- [ ] `docs/design-system/preview/components-destructive-confirm.html` showing variants (typed-phrase, hold-to-confirm fallback, multi-step) and required states per SKILL.md §7
- [ ] Spec doc per SKILL.md §8 including the GOVERNANCE.md §6 tier mapping

## Tokens / references

- Tokens: `tokens/colors.json` (danger palette)
- Reference: GOVERNANCE.md §6 destructive-action tiers, `patterns.html` "Destructive-action confirmation" pattern

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)

## Re-audit disposition (2026-05-17)

The bean's canonical name in the design system is `ConfirmDestructive`,
not `DestructiveConfirmDialog`. Already designed:

- `docs/design-system/ui_kits/mobile/ConfirmDestructive.jsx` — full React
  component, all 3 friction tiers (confirm / typed-the-name / cooldown),
  consequences list, recoverable flag, cooldown seconds, callbacks
- `docs/design-system/preview/patterns.html:137-166` — live demo with
  all three tiers and the "Delete Rowan" scenario

GOVERNANCE §6 explicitly requires Littles mode to hide Critical tier and
soften Medium tier copy.

Updated scope: extract into `components-confirm-destructive.html` (using
the canonical name). Add: explicit Littles-mode rendering showing the
hidden Critical and softened Medium, the 8 acceptance states (many N/A
for a transient dialog — mark them), 4 mode variants, 7-section doc.

Extraction task.
