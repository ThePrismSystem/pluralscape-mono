---
# api-1clw
title: Throttle sessions.lastActive updates to reduce write amplification
status: scrapped
type: task
priority: normal
created_at: 2026-03-13T19:09:33Z
updated_at: 2026-03-16T12:24:47Z
---

sessions.lastActive is written on every authenticated request. At scale this creates significant write amplification. Throttle updates to only write when lastActive is more than 60 seconds stale.

## Reasons for Scrapping

Subsumed by api-dcg4 (Session management), which includes "lastActive throttle (60s debounce)" in its scope.
