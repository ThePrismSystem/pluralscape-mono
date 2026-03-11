---
# db-zyf7
title: Generate and commit DB migrations
status: todo
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T19:39:48Z
parent: db-764i
---

Migration journals are empty (pg and sqlite). No deployable DDL, no RLS policy creation, no pgcrypto bootstrap. Integration tests create tables via helpers, not migrations. Add CI check for migration drift. Ref: audit CR1
