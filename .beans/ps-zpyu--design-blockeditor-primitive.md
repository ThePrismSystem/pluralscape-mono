---
# ps-zpyu
title: Design BlockEditor primitive
status: todo
type: task
created_at: 2026-05-17T06:28:19Z
updated_at: 2026-05-17T06:28:19Z
parent: ps-udt1
---

## Goal

Design the BlockEditor primitive: block-based editor for journal entries and wiki pages. Block types per features.md §7: paragraph, heading, list, quote, code, divider, image, member-link, fronting-snapshot. Block insertion menu, drag-handle reorder, slash-command quick-insert.

## Required output

- [ ] `docs/design-system/preview/components-block-editor.html` showing each block type rendered, the block-insertion menu, drag-handle hover state, slash-command palette, and required interactive states
- [ ] Spec doc per SKILL.md §8 covering: block menu anatomy, drag affordance, keyboard a11y (Tab indents, arrow keys move between blocks)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`, `tokens/typography.json`
- Reference: features.md §7

## Out of scope

- RN code (M11), screen-level integration (Journaling beans), member-link target picker (separate MemberPicker primitive)
