---
# ps-1v9l
title: Design RelationshipTypePicker primitive
status: todo
type: task
created_at: 2026-05-17T06:30:48Z
updated_at: 2026-05-17T06:30:48Z
parent: ps-udt1
---

## Goal

Design the RelationshipTypePicker primitive: pick a relationship type when creating an edge between two members. Bundled types per features.md §6: split-from, fused-from, sibling, partner, parent-child, protector-of, caretaker-of, gatekeeper-of, source, plus user-defined custom types. Indicates bidirectional vs directional.

## Required output

- [ ] `docs/design-system/preview/components-relationship-type-picker.html` showing variants (well-known list, custom-type create, with-direction-indicator) and required states
- [ ] Spec doc per SKILL.md §8

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: features.md §6 relationship data model

## Out of scope

- RN code (M11), screen-level integration (System structure beans)
