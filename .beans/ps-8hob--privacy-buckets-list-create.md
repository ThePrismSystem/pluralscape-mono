---
# ps-8hob
title: "Privacy: Buckets list + create"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:40:29Z
updated_at: 2026-05-17T07:42:02Z
parent: ps-9xue
blocked_by:
  - ps-5920
---

## Goal

Design the privacy bucket list (with per-bucket friend count + content count) and the bucket-create form.

## Surfaces

- Bucket list: `(app)/privacy/buckets/index.tsx`
- New: `(app)/privacy/buckets/new.tsx`

## Required states per surface

- list: empty (first-time), populated, with-rotation-needed badge per bucket, archived view, error
- create: empty/populated (name, color, description, optional emoji), invalid (name conflict), submitting

## Mode notes

- Littles: simplified — single "Friends I trust" preset bucket only; create flow hidden
- High-contrast: bucket color tile uses dot + emoji + label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), FAB, Card (bucket tile), BucketPill (ps-i6n1), Badge (rotation needed), EmptyState (ps-ruwi), TextField, TextArea, ColorSwatchPicker, EmojiPicker

## Data refs (informational)

- `apps/api/src/trpc/routers/bucket.ts` list, get, create with rotation-status summary

## Required output

- [ ] docs/design-system/preview/privacy-buckets-list-create.html with all states
- [ ] Rationale on rotation-needed surfacing

## Out of scope

- RN code (M11), data wiring (M12), bucket detail tabs (separate bean)
