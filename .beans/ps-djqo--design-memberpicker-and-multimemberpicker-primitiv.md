---
# ps-djqo
title: Design MemberPicker and MultiMemberPicker primitives
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:30:18Z
updated_at: 2026-05-17T08:50:23Z
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

## Re-audit disposition (2026-05-17)

Already designed in `components-pickers.html:227-300`. Full bottom-sheet
composite: search input → selected-tokens row → grouped result rows
(Recently fronted / Everyone else) → footer with named count action
("Add 2 members"). Composes on BottomSheet, TextField, MemberRow, and
token chips — already covered primitives.

Updated scope: extract into `components-member-picker.html`. The existing
preview already shows the multi-select case; add:

- Single-select variant (no tokens row, single-row commit)
- Zero-results state (composes with EmptyState)
- Selection-cap-reached state (e.g., "max 8 fronters")
- `includes-self` toggle for fronting check-in use
- `data-includes` variant that surfaces custom fronts and structure
  entities alongside members
- The 8 acceptance states, 4 mode variants, 7-section doc

Extraction + small additions, not from-scratch.
