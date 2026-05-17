---
# ps-t9lx
title: "Members: Photo gallery management"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:37:08Z
updated_at: 2026-05-17T07:42:08Z
parent: ps-07l7
blocked_by:
  - ps-5920
---

## Goal

Design the member-photo gallery management surface — upload, reorder, set primary, delete, and crop/edit existing photos. Distinct from member detail's photos tab (display-only).

## Surfaces

- Gallery management: invoked from member detail photos tab or inline edit

## Required states per surface

- empty (no photos), with-photos (grid), reorder mode (drag handles visible), uploading (progress per file), upload-error per file, with-image-cropper-modal open, with-set-primary indicator, deleting with confirm

## Mode notes

- Littles: gallery management hidden if any photos contain trauma-marker content; viewer-only
- High-contrast: drag-handle uses both icon + border-strong

## Primitives required

- BottomSheet (host), ImagePickerLauncher (existing), ImageCropper (ps-107o), ProgressBar (ps-3m01), Dialog (delete confirm), Button, Banner (offline queue notice)
- Polymorphic ImageSource discriminated union per features.md §1 (blob ref vs external URL)

## Data refs (informational)

- `apps/api/src/trpc/routers/member-photo.ts` list, create, update (reorder, set-primary), delete
- `apps/api/src/trpc/routers/blob.ts` presigned upload + confirm

## Required output

- [ ] docs/design-system/preview/members-photo-gallery.html with all states
- [ ] Rationale on the polymorphic ImageSource UI (when to surface "use external URL" affordance)

## Out of scope

- RN code (M11), data wiring (M12), the ImagePickerLauncher / ImageCropper primitives (Phase 0)
