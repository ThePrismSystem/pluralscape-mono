---
# ps-xi6m
title: "Cross-cutting: Mention link + member proxy preview card"
status: todo
type: feature
created_at: 2026-05-17T06:51:15Z
updated_at: 2026-05-17T06:51:15Z
parent: ps-k8mz
---

## Goal

Design the inline mention chip + tap-to-expand preview card used across journal entries, comm messages, and structure docs to reference a member, custom front, or innerworld location.

## Surfaces

- Inline @member mention chip.
- Inline #front mention chip.
- Inline ~location mention chip.
- Expanded preview card (member: avatar + pronouns + role).
- Expanded preview card (front: badge + active-since).
- Expanded preview card (location: icon + brief).
- Mention picker (autocomplete dropdown).
- Broken-mention state (entity deleted).

## Required states per surface

- Default (collapsed chip).
- Tapped / expanded card.
- Picker open (autocomplete results).
- Picker — no results.
- Broken-mention.

## Mode notes

- Default mode only.
- Littles mode: simpler picker UI — noted for Phase 3.

## Primitives required

- Chip primitive.
- Card primitive.
- Autocomplete primitive.
- Avatar primitive.

## Data refs (informational)

- members, custom-fronts, innerworld-locations routers (informational; no wiring here).

## Required output

- HTML mockup of all 3 mention types × states + picker in docs/design-system/preview/cross-cutting/mentions.html.
- Decision notes: chip color per entity type, picker keyboard nav.

## Out of scope

- RN implementation (M11).
- Markdown parser (M11/M12).
