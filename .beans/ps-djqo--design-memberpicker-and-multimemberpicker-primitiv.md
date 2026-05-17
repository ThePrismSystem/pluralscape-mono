---
# ps-djqo
title: Design MemberPicker and MultiMemberPicker primitives
status: todo
type: task
created_at: 2026-05-17T06:30:18Z
updated_at: 2026-05-17T06:30:18Z
parent: ps-udt1
---

## Goal

Design the MemberPicker (single-pick) and MultiMemberPicker (multi-pick) primitives together — they share the search + member-row pattern and identity rendering rules. Used for poll voters, mention targets, group assignment, fronting member selection.

## Required output

- [ ] `docs/design-system/preview/components-member-picker.html` showing both primitives with variants (empty system, small system, large system with search, with-archived-toggle) and required states
- [ ] Spec doc per SKILL.md §8 (single doc covering both — note where behavior diverges)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: GOVERNANCE.md §4 member identity rules, `apps/api/src/trpc/routers/member.ts`

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)
