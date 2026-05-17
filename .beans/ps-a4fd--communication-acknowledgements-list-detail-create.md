---
# ps-a4fd
title: "Communication: Acknowledgements (list + detail + create)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:39:42Z
updated_at: 2026-05-17T07:42:03Z
parent: ps-5fc5
blocked_by:
  - ps-5920
---

## Goal

Design the mandatory-acknowledgement surfaces — targeted alerts persisting until a specific member confirms. List of pending + resolved, detail with confirm action, create form.

## Surfaces

- Ack list: `(app)/communicate/acks/index.tsx`
- Ack detail: `(app)/communicate/acks/[id].tsx`
- New: `(app)/communicate/acks/new.tsx`

## Required states per surface

- list: empty, with-pending-on-me (highlighted), with-pending-on-others, resolved view, archived view, error
- detail: pending-on-me (with confirm CTA), pending-on-others (read-only with target chip), resolved (with confirmation timestamp + by-whom), archived
- create: empty/populated, with target-member picker, with-bucket-picker, with optional response-deadline, submitting

## Mode notes

- Littles: acks hidden (caregiver-only); Littles members surfaced via simplified prompt instead
- High-contrast: pending vs resolved use icon + label (not color-only)

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (ack tile), FAB, Banner (pending-on-me CTA), RichTextField (ps-9yhh), MemberPicker (ps-djqo), BucketPicker (ps-s9r6), DateTimePicker (deadline), Button (confirm), EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/acknowledgement.ts` list, get, create, confirm, archive, restore, delete

## Required output

- [ ] docs/design-system/preview/comm-acknowledgements.html with all surfaces + states
- [ ] Copy decisions on the "this needs you" framing (per GOVERNANCE.md §7)

## Out of scope

- RN code (M11), data wiring (M12), push notification delivery surfaces (Privacy & Social beans)
