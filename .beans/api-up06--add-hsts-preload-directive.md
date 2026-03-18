---
# api-up06
title: Add HSTS preload directive
status: completed
type: task
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T07:40:31Z
parent: api-i2pw
---

HSTS header includes max-age and includeSubDomains but not preload. Add when domain is ready for preload list. Ref: audit S-12.

## Summary of Changes\n\nAppended `; preload` to the HSTS header in production mode. Updated corresponding test assertion.
