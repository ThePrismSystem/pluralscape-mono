---
# ps-a200
title: "Home: Web/tablet layout adaptation (Drawer + content)"
status: todo
type: feature
created_at: 2026-05-17T06:35:46Z
updated_at: 2026-05-17T06:35:46Z
parent: ps-divy
---

## Goal

Design the ≥1024px responsive layout — Drawer rail on the left, content on the right. Drawer hosts what the mobile More tab hosts plus the bottom-tab nav.

## Surfaces

- Web/tablet adapted shell: applies to every `(app)` route at ≥1024px viewport

## Required states per surface

- default (drawer expanded), collapsed-rail (icons only), with-system-switcher-expanded, with-section-active-highlight

## Mode notes

- Littles: web mode still applies but with fewer drawer entries; collapsed-rail disabled (always-expanded for clarity)
- High-contrast: drawer separation from content uses 2px border with `--border-strong`

## Primitives required

- Drawer (ps-217e), SystemSwitcher (ps-a5pt), ScreenScaffold, ListItem (drawer entries), Badge, Icon

## Data refs (informational)

- Viewport breakpoint detection — local state, not server data
- Same section enablement as More hub

## Required output

- [ ] docs/design-system/preview/home-web-layout.html showing the layout at both 1024px and ~1600px widths
- [ ] Rationale on the rail / expanded breakpoint thresholds

## Out of scope

- RN code (M11), data wiring (M12), the Drawer primitive itself (Phase 0)
