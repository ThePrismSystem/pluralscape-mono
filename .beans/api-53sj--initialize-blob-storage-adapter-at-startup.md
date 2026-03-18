---
# api-53sj
title: Initialize blob storage adapter at startup
status: todo
type: bug
priority: critical
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:12:32Z
parent: api-i2pw
---

getStorageAdapter() requires initStorageAdapter() at startup, but no call site exists. All blob routes throw at runtime. Add initialization in index.ts start() function. Ref: audit S-1.
