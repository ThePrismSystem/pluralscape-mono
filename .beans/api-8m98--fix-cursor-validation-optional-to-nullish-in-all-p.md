---
# api-8m98
title: "Fix cursor validation: .optional() to .nullish() in all paginated routers"
status: completed
type: bug
priority: critical
created_at: 2026-04-03T05:10:35Z
updated_at: 2026-04-16T07:29:52Z
parent: ps-7j8n
---

20+ routers use `cursor: z.string().optional()` for pagination. React Query passes `cursor: undefined` during invalidation refetch, which can fail validation. Must change to `.nullish()` per tRPC validators skill.

Affected files: member.ts, fronting-session.ts, blob.ts, auth.ts, message.ts, fronting-report.ts, webhook-config.ts, acknowledgement.ts, friend-code.ts, board-message.ts, note.ts, snapshot.ts, system.ts, fronting-comment.ts, group.ts, timer-config.ts, custom-front.ts, device-token.ts, webhook-delivery.ts, field.ts, lifecycle-event.ts, poll.ts, check-in-record.ts, api-key.ts, innerworld.ts

Source: tRPC validators skill — cursor .nullish() pattern

## Summary of Changes\n\nChanged cursor: z.string().optional() to z.string().nullish() across 31 routers (39 occurrences). Added ?? undefined coercion at service boundaries.
