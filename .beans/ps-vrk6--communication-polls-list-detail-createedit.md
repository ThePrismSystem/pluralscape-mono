---
# ps-vrk6
title: "Communication: Polls (list + detail + create/edit)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:39:24Z
updated_at: 2026-05-17T07:42:08Z
parent: ps-5fc5
blocked_by:
  - ps-5920
---

## Goal

Design the Polls surfaces — list, detail (with current results preview), create/edit. Poll kinds: standard or custom. Options can have color and emoji; voters can be members or structure entities (polymorphic EntityReference).

## Surfaces

- Poll list: `(app)/communicate/polls/index.tsx`
- Poll detail: `(app)/communicate/polls/[id].tsx`
- New: `(app)/communicate/polls/new.tsx`
- Edit: `(app)/communicate/polls/[id]/edit.tsx`

## Required states per surface

- list: empty, open (with vote count), closed, archived view, filtered by-author, error
- detail: open with-results-preview, ended with-final-results, with-veto warning, with-abstain count
- create/edit: empty/populated, with kind toggle (standard / custom), with options builder (color + emoji per option), with abstain toggle, with veto toggle, with end-date picker, with bucket picker, with eligible-voters picker (polymorphic), submitting

## Mode notes

- Littles: polls feature disabled by default
- High-contrast: option colors paired with emoji + label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (poll tile), FAB, TextField (question), TextField (option label), ColorSwatchPicker (per option), EmojiPicker (per option), DateTimePicker (end-date), BucketPicker (ps-s9r6), Switch (abstain, veto), EntityRefPicker (ps-ywtb, eligible voters), Banner (ended notice), EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/poll.ts` list, get, create, update, close, archive, restore, delete

## Required output

- [ ] docs/design-system/preview/comm-polls-list-crud.html with all surfaces + states
- [ ] Rationale on option-builder UX (drag-reorder vs sequential add)

## Out of scope

- RN code (M11), data wiring (M12), vote + results visualization (separate bean)
