---
# ps-gnkq
title: Design SyncIndicator primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:27:03Z
updated_at: 2026-05-17T08:50:22Z
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

## Re-audit disposition (2026-05-17)

Original audit (ps-sg8k) misnamed this — the existing component is
`SyncState`, not `SyncIndicator`. Already designed in two places:

- `docs/design-system/ui_kits/mobile/SyncState.jsx` — full React component
- `docs/design-system/preview/patterns.html` "State of data" section —
  renders all 10 state variants: savedLocal, syncing, synced, offline,
  syncFailed, conflict, encrypted, keyUnavailable, exportReady, importPending

Each variant carries a screen-reader-only sentence and the right
`aria-live` politeness already.

Updated scope: extract into `components-sync-state.html` (renaming the bean
target from SyncIndicator to SyncState to match the canonical name).
Add the 8 acceptance states and 4 mode variants per primitive. Verify the
aria-live politeness is correctly tiered.
