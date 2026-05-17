---
# ps-82u6
title: "Members: Duplicate flow + archive + delete confirms"
status: todo
type: feature
created_at: 2026-05-17T06:36:51Z
updated_at: 2026-05-17T06:36:51Z
parent: ps-07l7
---

## Goal

Design the three destructive / semi-destructive member operations as a cohesive set: duplicate modal (semi-destructive — creates new entity), archive confirm dialog (reversible), delete confirm dialog (permanent, requires DestructiveConfirmDialog tier).

## Surfaces

- Duplicate: `(modals)/member-duplicate.tsx`
- Archive confirm: `(modals)/member-archive.tsx`
- Delete confirm: `(modals)/member-delete.tsx`

## Required states per surface

- duplicate: copy-options-pick (name override, copy-photos toggle, copy-fields toggle, copy-group-memberships toggle, copy-structure-links toggle), submitting, success-redirect-to-new
- archive: warning + ack, submitting, success, undo-toast surfaced after dismiss
- delete: warning, dependent-409 (cannot delete with active fronting / lifecycle event references), typed-confirm "DELETE [member name]", submitting, success-redirect-to-list

## Mode notes

- Littles: delete hidden entirely; archive copy softened ("Put away")
- High-contrast: every destructive dialog uses icon + label (not color-only)

## Primitives required

- Dialog or BottomSheet (host), DestructiveConfirmDialog (ps-bydy), Switch (copy toggles), TextField (typed-confirm), Banner (409 warning), Button, Toast (undo affordance after archive)

## Data refs (informational)

- `apps/api/src/trpc/routers/member.ts` duplicate, archive, restore, delete

## Required output

- [ ] docs/design-system/preview/members-destructive-flows.html with all three flows + states
- [ ] Copy decisions per GOVERNANCE.md §6 destructive tiers

## Out of scope

- RN code (M11), data wiring (M12), undo handling logic
