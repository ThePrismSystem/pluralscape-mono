---
# ps-5lr6
title: Design KeyValueRow primitive
status: todo
type: task
created_at: 2026-05-17T06:28:01Z
updated_at: 2026-05-17T06:28:01Z
parent: ps-udt1
---

## Goal

Design the KeyValueRow primitive: a label + value row for details screens, audit-log entries, settings descriptions. Often grouped inside Section. Supports truncation rules, copy-to-clipboard affordance, inline edit hint.

## Required output

- [ ] `docs/design-system/preview/components-key-value-row.html` showing variants (single-line, wrapped, with-copy-button, with-edit-pencil, long-value-truncated) and required states
- [ ] Spec doc per SKILL.md §8

## Tokens / references

- Tokens: `tokens/colors.json` (fg-muted for keys, fg for values), `tokens/typography.json`
- Reference: `components-display.html` if a KeyValueRow variant already exists; extend rather than duplicate

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)
