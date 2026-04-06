---
# ps-ti5h
title: "Performance: tune staleTime for stable data hooks"
status: todo
type: task
priority: low
created_at: 2026-04-06T00:53:46Z
updated_at: 2026-04-06T00:53:46Z
parent: ps-y621
---

Several hooks use the default 30s staleTime for data that rarely changes:

- useAccount() — account data rarely changes, use 5min staleTime
- refetchOnWindowFocus: true on all queries — consider false for stable data, 'always' only for time-sensitive (active fronters)

Also: ConnectionProvider.tsx:35 useEffect depends on auth.snapshot which may be a new object reference every render, causing unnecessary connect() calls.

Audit ref: Pass 3 MEDIUM + LOW
