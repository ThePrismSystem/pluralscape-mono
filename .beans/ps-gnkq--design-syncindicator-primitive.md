---
# ps-gnkq
title: Design SyncIndicator primitive
status: todo
type: task
created_at: 2026-05-17T06:27:03Z
updated_at: 2026-05-17T06:27:03Z
parent: ps-udt1
---

## Goal

Design the SyncIndicator primitive: small inline indicator surfacing the 9 canonical data-state values from GOVERNANCE.md §5 (saved-local, syncing, synced, conflict, offline, import-pending, export-ready, failed, key-unavailable). Used in headers, list rows, and detail screens.

## Required output

- [ ] `docs/design-system/preview/components-sync-indicator.html` showing all 9 data-state variants with their canonical icon + color + label per GOVERNANCE.md §5
- [ ] Spec doc per SKILL.md §8 (with explicit note that color is never the only signal — icon + label always accompany)

## Tokens / references

- Tokens: `tokens/colors.json` (semantic mapping per data-state)
- Reference: GOVERNANCE.md §5 (canonical), `patterns.html` "State of data" pattern, `ui_kits/mobile/SyncState.jsx`

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)
