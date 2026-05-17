---
# ps-gml0
title: Design EntityTypePicker primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:30:52Z
updated_at: 2026-05-17T19:06:46Z
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

## Entity-type scope (2026-05-17)

The audit's variant list was wrong. The picker chooses from
**user-defined** `system_structure_entity_types`, not a fixed canonical
enum. Each system creates its own entity types (e.g. caretaker,
protector, host, source, anchor) via the structure-entity-types
settings; the picker renders that list dynamically.

Therefore the preview should show:

- Empty-system state (no custom types defined yet — affordance to
  create the first one)
- Typical-system state (4–8 types listed, each with the system's chosen
  color/icon)
- Many-types state (12+, demonstrating the scroll behavior and search)
- With-create-new affordance (opens the structure-entity-type creator)
- Read-only variant (no create affordance)

There are NO global / built-in entity types — every name and visual
property comes from the system. Do not hardcode "member" or "custom
front" as defaults; those are separate entity tables, not structure
entity types.
