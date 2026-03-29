---
# api-q642
title: Wire identity webhook events (9 events)
status: done
type: task
priority: high
created_at: 2026-03-29T02:07:29Z
updated_at: 2026-03-29T03:03:50Z
parent: api-9wze
---

Add dispatchWebhookEvent() calls to: member.service (created/updated/archived), group.service (created/updated), fronting-session.service (started/ended), lifecycle-event.service (event-recorded), custom-front.service (changed). All use system-scoped transactions — straightforward wiring.

## Summary of Changes

Wired dispatchWebhookEvent calls into 6 service files for 9 identity events:

- member.service: member.created (create + duplicate), member.updated, member.archived
- group.service: group.created (create + copy via hierarchy factory), group.updated (update + move via hierarchy factory)
- fronting-session.service: fronting.started (create), fronting.ended (end)
- lifecycle-event.service: lifecycle.event-recorded (create)
- custom-front.service: custom-front.changed (create + update)

Added optional webhookEvents config to hierarchy-service-factory for generic create/update dispatch.
