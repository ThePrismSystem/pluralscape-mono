---
# ps-7to1
title: Design CheckInPrompt primitive
status: todo
type: task
created_at: 2026-05-17T06:29:47Z
updated_at: 2026-05-17T06:29:47Z
parent: ps-udt1
---

## Goal

Design the CheckInPrompt primitive: dissociation check-in card hosted in a modal or bottom sheet when a timer fires. Soft non-punitive copy per GOVERNANCE.md §7. Three primary actions: respond, dismiss, archive (Littles mode hides dismiss).

## Required output

- [ ] `docs/design-system/preview/components-check-in-prompt.html` showing variants (default, Littles-mode simplified, with response-compose-open, with offline-queued banner) and required states
- [ ] Spec doc per SKILL.md §8 (copy contract: gentle question variants; voice rules from GOVERNANCE.md §7)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`, `tokens/typography.json`
- Reference: features.md §2 (dissociation check-ins), `apps/api/src/trpc/routers/check-in-record.ts`

## Out of scope

- RN code (M11), screen-level integration (the Fronting check-ins screen bean, ps-f0qp)
