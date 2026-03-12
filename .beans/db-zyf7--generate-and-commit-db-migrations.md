---
# db-zyf7
title: Generate and commit DB migrations
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-12T03:06:53Z
parent: db-764i
---

Migration journals are empty (pg and sqlite). No deployable DDL, no RLS policy creation, no pgcrypto bootstrap. Integration tests create tables via helpers, not migrations. Add CI check for migration drift. Ref: audit CR1

## Summary of Changes\n\nGenerated initial migrations for both PG and SQLite using drizzle-kit. Fixed `db:generate` scripts to use tsx for ESM compatibility. Added tsx as a devDependency.
