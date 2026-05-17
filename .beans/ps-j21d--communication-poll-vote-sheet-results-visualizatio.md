---
# ps-j21d
title: "Communication: Poll vote sheet + results visualization"
status: todo
type: feature
created_at: 2026-05-17T06:39:33Z
updated_at: 2026-05-17T06:39:33Z
parent: ps-5fc5
---

## Goal

Design the vote-cast sheet and the dedicated results visualization screen. Votes support optional comment + veto flag; null option = abstain.

## Surfaces

- Vote sheet: `(sheets)/poll-vote.tsx`
- Results: `(app)/communicate/polls/[id]/results.tsx`

## Required states per surface

- vote sheet: idle, option-selected, with comment compose, with veto-toggle, abstain pick, submitting, already-voted (with update affordance), error
- results: live (open poll), final (closed), with consensus-summary banner, per-option-breakdown, per-voter list (if visibility allows), with comments stream

## Mode notes

- Littles: vote sheet hidden (polls disabled by default)
- High-contrast: chart segments use pattern + label (not color-only)

## Primitives required

- BottomSheet (vote host), RadioGroup (option pick), TextArea (comment), Switch (veto), Button, ScreenScaffold (results), Chart primitive (Phase 0 candidate; bar/donut), MemberCard (voter list), EntityRefPicker (ps-ywtb) for structure-entity voters, ListItem (comments), EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/poll.ts` castVote, updateVote, deleteVote, listVotes, results

## Required output

- [ ] docs/design-system/preview/comm-poll-vote-results.html with all states
- [ ] Rationale on results-visualization choices (bar vs donut vs ranked-list)

## Out of scope

- RN code (M11), data wiring (M12), the poll list / detail / CRUD (separate bean)
