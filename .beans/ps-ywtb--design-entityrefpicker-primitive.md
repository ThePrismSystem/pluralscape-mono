---
# ps-ywtb
title: Design EntityRefPicker primitive
status: todo
type: task
created_at: 2026-05-17T06:30:23Z
updated_at: 2026-05-17T06:30:23Z
parent: ps-udt1
---

## Goal

Design the EntityRefPicker primitive: polymorphic picker returning an `EntityReference` discriminated union (member, custom-front, or structure-entity). Used wherever a fronting subject, comment target, or polymorphic entity must be chosen.

## Required output

- [ ] `docs/design-system/preview/components-entity-ref-picker.html` showing variants (segmented filter for kind, all-kinds search, kind-restricted) and required states
- [ ] Spec doc per SKILL.md §8 (visual disambiguation between the three entity kinds in result rows)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: `EntityReference` type in `packages/types/`, features.md §2 (polymorphic subjects)

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)
