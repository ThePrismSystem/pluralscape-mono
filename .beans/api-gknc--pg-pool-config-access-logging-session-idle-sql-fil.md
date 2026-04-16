---
# api-gknc
title: PG pool config, access logging, session idle SQL filtering
status: completed
type: task
priority: normal
created_at: 2026-03-19T01:37:59Z
updated_at: 2026-04-16T07:29:45Z
parent: ps-afy4
---

Milestone 2 audit remediation: (1) Add PG pool config + graceful shutdown, (2) Add HTTP access logging middleware, (3) Push session idle timeout filtering into SQL.

## Summary of Changes

- Added explicit PG pool configuration (max connections, idle/connect/lifetime timeouts) with constants
- Exposed rawClient (Closeable interface) on PgDatabaseClient for shutdown draining
- Added SIGTERM/SIGINT signal handlers for graceful shutdown (stop server, drain pool)
- Added HTTP access logging middleware (method, path, status, duration at info level)
- Pushed session idle timeout filtering into SQL via buildIdleTimeoutFilter()
- Replaced in-memory cursor pagination with SQL-level cursor filtering
- Switched to limit+1 hasMore pattern, removing MAX_SESSIONS_FETCH_LIMIT
