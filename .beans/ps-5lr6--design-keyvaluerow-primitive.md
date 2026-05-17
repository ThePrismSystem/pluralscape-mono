---
# ps-5lr6
title: Design KeyValueRow primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:28:01Z
updated_at: 2026-05-17T08:50:22Z
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

## Re-audit disposition (2026-05-17)

Already designed in `components-display.html:314-321`. Renders the
standard key/value row with mono variant for IDs and keys, plus the
`plaintext` tag variant that marks server-visible-as-cleartext fields
(timestamps, record IDs, sync metadata). The doc meta explicitly notes
the T1/T2 policy (see ps-gfhz scrap reason).

Updated scope: extract into `components-keyvalue-row.html`. Add: copy-on-tap
variant for IDs, sensitive-value masked variant, the 8 acceptance states,
4 mode variants, 7-section doc.

Extraction task.
