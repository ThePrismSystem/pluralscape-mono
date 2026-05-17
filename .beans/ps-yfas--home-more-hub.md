---
# ps-yfas
title: "Home: More hub"
status: todo
type: feature
created_at: 2026-05-17T06:35:18Z
updated_at: 2026-05-17T06:35:18Z
parent: ps-divy
---

## Goal

Design the More hub — overflow tab for sections that don't fit in the primary tab bar. Settings entry, Innerworld, System structure, Journal, Search, Data import/export, Help.

## Surfaces

- More: `(app)/(tabs)/more.tsx`

## Required states per surface

- default (full grid of section cards)
- with-badge on Settings (e.g. recovery-key reminder due)
- offline (greyed-out sections that require network)

## Mode notes

- Littles: fewer sections — only Help and Settings shown
- Web ≥1024px: this tab disappears entirely (Drawer hosts those sections)

## Primitives required

- ScreenScaffold, Card (section tiles), Icon, Badge, ListItem (variant)

## Data refs (informational)

- Section enablement comes from system settings + account flags (e.g. import disabled if `importsEnabled=false`)

## Required output

- [ ] docs/design-system/preview/home-more-hub.html with all states
- [ ] Rationale on section ordering and grouping

## Out of scope

- RN code (M11), data wiring (M12), individual section landing screens (separate beans)
