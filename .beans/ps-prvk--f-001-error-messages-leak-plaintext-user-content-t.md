---
# ps-prvk
title: "F-001: Error messages leak plaintext user content to server"
status: todo
type: bug
priority: critical
created_at: 2026-04-10T21:05:28Z
updated_at: 2026-04-10T21:05:28Z
parent: ps-n0tq
---

Mapper error messages embed sp.name (plaintext member/group/channel names) into ImportError.message, which gets persisted to import_jobs.error_log on the zero-knowledge server. Affected files: member.mapper.ts:130, group.mapper.ts:47, channel.mapper.ts:82, helpers.ts:39. Fix: reference only opaque source IDs in error messages.
