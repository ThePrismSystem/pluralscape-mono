---
# db-ncyx
title: Add expiresAt to sessions table
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:48Z
parent: db-764i
---

sessions tracks lastActive and revoked but no expiresAt. No passive expiry mechanism. Stale session rows are a security liability (enumeration surface) and performance concern. Ref: audit H8
