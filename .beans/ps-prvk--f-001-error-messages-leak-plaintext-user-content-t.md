---
# ps-prvk
title: "F-001: Error messages leak plaintext user content to server"
status: completed
type: bug
priority: critical
created_at: 2026-04-10T21:05:28Z
updated_at: 2026-04-11T21:30:59Z
parent: ps-n0tq
---

Mapper error messages embed sp.name (plaintext member/group/channel names) into ImportError.message, which gets persisted to import_jobs.error_log on the zero-knowledge server. Affected files: member.mapper.ts:130, group.mapper.ts:47, channel.mapper.ts:82, helpers.ts:39. Fix: reference only opaque source IDs in error messages.

## Summary of Changes

All mapper error messages that previously embedded plaintext user content (member/group/channel names) now use only opaque source IDs:

- `member.mapper.ts:130` — references `sp._id` instead of `sp.name`.
- `group.mapper.ts:47` — references `sp._id` instead of `sp.name`, plus integrates `summarizeMissingRefs` to truncate long ref lists (also closes F-007).
- `channel.mapper.ts:82` — references `sp._id` instead of `sp.name`.
- `poll.mapper.ts` — error message referenced `sp.name` in fk-miss path; also corrected to `sp._id`.

Added a regression test in `group.mapper.test.ts` verifying error messages never include the group name.
