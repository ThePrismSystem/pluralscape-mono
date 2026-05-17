---
# ps-9yhh
title: Design RichTextField primitive
status: todo
type: task
created_at: 2026-05-17T06:28:24Z
updated_at: 2026-05-17T06:28:24Z
parent: ps-udt1
---

## Goal

Design the RichTextField primitive: block-aware single-message rich-text input for chat composer, board-message composer, and notes. Lighter than BlockEditor — inline formatting only (bold/italic, member @mentions, member-link, emoji), no block-type switching.

## Required output

- [ ] `docs/design-system/preview/components-rich-text-field.html` showing variants (empty, typing, with-mention-picker open, with-formatting-toolbar) and required states
- [ ] Spec doc per SKILL.md §8 covering: @-mention picker invocation, formatting toolbar layout, paste-handling rules (strip foreign formatting)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`, `tokens/typography.json`
- Reference: features.md §3

## Out of scope

- RN code (M11), screen-level integration (Communication beans), MemberPicker / member-link target picker (separate)
