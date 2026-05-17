---
# ps-7vlc
title: "Settings: API keys (list + create wizard + detail/revoke)"
status: todo
type: feature
created_at: 2026-05-17T06:46:31Z
updated_at: 2026-05-17T06:46:31Z
parent: ps-6a3x
---

## Goal

Design the API key surfaces — list of issued keys, create wizard (name + scopes + expiry), detail with reveal once / revoke.

## Surfaces

- List: `(app)/settings/integrations/api-keys/index.tsx`
- Create wizard: `(app)/settings/integrations/api-keys/new.tsx`
- Detail / revoke: `(app)/settings/integrations/api-keys/[id].tsx`

## Required states per surface

- list: empty, populated (with last-used indicator), with-near-expiry warning, archived view, error
- create wizard: step 1 name + purpose label, step 2 scope-pick (read / write / sync, per-resource), step 3 expiry (60d / 1y / never), step 4 reveal-once key with copy / save / never-show-again ack
- detail: post-creation read-only metadata, with-revoke affordance, revoked-state

## Mode notes

- Littles: hidden entirely
- High-contrast: key reveal monospace + segmented

## Primitives required

- ScreenScaffold, WizardStepper (pattern, ps-rhno), InfiniteList (ps-hijf), FAB, Card (key tile), TextField, Select (expiry preset), Switch (per-scope), RecoveryKeyField (ps-o1zp, re-skinned for key display + copy), KeyValueRow (ps-5lr6), DestructiveConfirmDialog (ps-bydy), Banner (near-expiry), Button, EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/api-key.ts` list, get, create (returns reveal-once key), revoke

## Required output

- [ ] docs/design-system/preview/settings-api-keys.html with all surfaces + states
- [ ] Rationale on scope-pick UX (per-resource grid vs preset role)

## Out of scope

- RN code (M11), data wiring (M12), the actual scope schema (server-defined)
