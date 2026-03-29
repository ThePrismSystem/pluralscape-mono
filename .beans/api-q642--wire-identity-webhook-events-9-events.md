---
# api-q642
title: Wire identity webhook events (9 events)
status: todo
type: task
priority: high
created_at: 2026-03-29T02:07:29Z
updated_at: 2026-03-29T03:03:50Z
parent: api-9wze
---

Add dispatchWebhookEvent() calls to: member.service (created/updated/archived), group.service (created/updated), fronting-session.service (started/ended), lifecycle-event.service (event-recorded), custom-front.service (changed). All use system-scoped transactions — straightforward wiring.

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
