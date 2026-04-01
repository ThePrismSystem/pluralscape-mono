---
# ps-0azs
title: "OPFS wa-sqlite driver: implement parameterized query support via prepare/bind/step API"
status: todo
type: task
created_at: 2026-04-01T04:13:11Z
updated_at: 2026-04-01T04:13:11Z
parent: ps-u3ug
---

The current opfs-sqlite-driver.ts uses wa-sqlite's exec() which doesn't support bind parameters. The run()/all()/get() methods currently ignore params. Implement the lower-level prepare/bind/step API for parameterized queries needed by SqliteStorageAdapter and SqliteOfflineQueueAdapter. Required before the OPFS path can fully replace IndexedDB fallback.
