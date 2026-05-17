---
# ps-gml0
title: Design EntityTypePicker primitive
status: todo
type: task
created_at: 2026-05-17T06:30:52Z
updated_at: 2026-05-17T06:30:52Z
parent: ps-udt1
---

## Goal

Design the EntityTypePicker primitive: pick a system-defined structure entity type when creating a structure entity. Sources from the per-system list of `system_structure_entity_types` (e.g. "Subsystem", "Side System", "Layer"). Inline "+ create new type" affordance shortcuts to entity-type create.

## Required output

- [ ] `docs/design-system/preview/components-entity-type-picker.html` showing variants (single-type system, many-type system, with "+ create" affordance, empty — first entity ever) and required states
- [ ] Spec doc per SKILL.md §8

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: features.md §6 generic structure entity model

## Out of scope

- RN code (M11), screen-level integration (System structure beans)
