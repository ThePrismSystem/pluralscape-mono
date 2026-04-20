---
# ps-ts6a
title: Enforce HTTPS on PluralKit API baseUrl
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: ps-v7el
---

Finding [Security] from audit 2026-04-20 import-pk report. packages/import-pk/src/sources/pk-api-source.ts. No token validation before passing to pkapi.js, no HTTPS-enforcement equivalent to assertBaseUrlIsSafe (SP source). Rogue baseUrl could exfiltrate PK token over plain HTTP.
