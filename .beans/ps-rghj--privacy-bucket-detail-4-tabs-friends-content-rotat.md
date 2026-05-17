---
# ps-rghj
title: "Privacy: Bucket detail (4 tabs — friends / content / rotation / settings)"
status: todo
type: feature
created_at: 2026-05-17T06:40:40Z
updated_at: 2026-05-17T06:40:40Z
parent: ps-9xue
---

## Goal

Design the bucket detail screen with 4 tabbed sub-views.

## Surfaces

- Bucket detail: `(app)/privacy/buckets/[bucketId]/index.tsx` (settings, default)
- Friends tab: `(app)/privacy/buckets/[bucketId]/friends.tsx`
- Content tab: `(app)/privacy/buckets/[bucketId]/content.tsx`
- Rotation tab: `(app)/privacy/buckets/[bucketId]/rotation.tsx`
- Settings tab: `(app)/privacy/buckets/[bucketId]/settings.tsx`

## Required states per surface

- header: default with name + color + count summaries
- friends: empty (no friends assigned), populated, with-add-friend affordance, with-revoke confirm
- content: empty (no entities tagged), populated grouped by entity-type, with-untagged-warning banner if everything is empty, search/filter
- rotation: idle (no rotation in progress), in-progress with KeyRotationStepper (ps-oipx), failed-with-retry, complete-with-summary
- settings: rename, color, emoji, description, archive, delete

## Mode notes

- Littles: rotation tab hidden (caregiver-only); settings tab hides delete
- High-contrast: per-entity-type group headers use icon + label (color is supplemental)

## Primitives required

- ScreenScaffold, Tabs (existing), BucketPill (ps-i6n1), InfiniteList (ps-hijf), Card (friend / entity rows), KeyRotationStepper (ps-oipx), EmptyState (ps-ruwi), Banner (untagged-warning, rotation-needed), Button, DestructiveConfirmDialog (ps-bydy), KeyValueRow (ps-5lr6)

## Data refs (informational)

- `apps/api/src/trpc/routers/bucket.ts` get, friends, tags (content), rotation routes, update, delete

## Required output

- [ ] docs/design-system/preview/privacy-bucket-detail.html with all 4 tabs + states
- [ ] Rationale on the content-tab grouping (per-entity-type vs flat)

## Out of scope

- RN code (M11), data wiring (M12), the bucket export flow (separate bean), the KeyRotationStepper primitive (Phase 0)
