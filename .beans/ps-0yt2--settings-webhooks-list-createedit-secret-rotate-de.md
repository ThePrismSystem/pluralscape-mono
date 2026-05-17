---
# ps-0yt2
title: "Settings: Webhooks (list + create/edit + secret rotate + delivery log)"
status: todo
type: feature
created_at: 2026-05-17T06:46:41Z
updated_at: 2026-05-17T06:46:41Z
parent: ps-6a3x
---

## Goal

Design the webhook surfaces — list of configured endpoints, create / edit form, secret rotate modal, per-webhook delivery log.

## Surfaces

- List: `(app)/settings/integrations/webhooks/index.tsx`
- New: `(app)/settings/integrations/webhooks/new.tsx`
- Edit: `(app)/settings/integrations/webhooks/[id]/edit.tsx`
- Secret rotate: `(modals)/webhook-secret-rotate.tsx`
- Delivery log: `(app)/settings/integrations/webhooks/[id]/deliveries.tsx`

## Required states per surface

- list: empty, populated (with last-delivery success / failure indicator per row), archived view, error
- create/edit: URL + per-event-kind toggles + secret (generated) + payload encryption Switch + test-ping affordance, invalid, submitting
- secret rotate: warning (existing-secret will-stop-validating), new-secret reveal-once with copy, ack-complete, success
- delivery log: empty, populated (paginated with status badge per delivery), filtered (by-status, by-event-kind), per-row expand-for-payload, with-retry affordance for failed

## Mode notes

- Littles: hidden entirely
- High-contrast: delivery status uses icon + label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), FAB, Card (webhook tile), TextField, Switch (per-event-kind), Button (test-ping), Banner (rotate warning), RecoveryKeyField (ps-o1zp, re-skinned secret display), KeyValueRow (ps-5lr6, delivery row), Badge (delivery status), Accordion (ps-ecpl, payload expand), DestructiveConfirmDialog (ps-bydy), EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/webhook-config.ts` CRUD + rotate + test-ping
- `apps/api/src/trpc/routers/webhook-delivery.ts` list, retry

## Required output

- [ ] docs/design-system/preview/settings-webhooks.html with all surfaces + states
- [ ] Rationale on the test-ping placement and the delivery-log row density

## Out of scope

- RN code (M11), data wiring (M12)
