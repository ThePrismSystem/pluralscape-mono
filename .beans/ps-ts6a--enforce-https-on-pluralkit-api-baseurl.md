---
# ps-ts6a
title: Enforce HTTPS on PluralKit API baseUrl
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T11:52:04Z
parent: ps-v7el
---

Finding [Security] from audit 2026-04-20 import-pk report. packages/import-pk/src/sources/pk-api-source.ts. No token validation before passing to pkapi.js, no HTTPS-enforcement equivalent to assertBaseUrlIsSafe (SP source). Rogue baseUrl could exfiltrate PK token over plain HTTP.

## Summary of Changes

pk-api-source now asserts HTTPS on baseUrl (when caller overrides the pkapi.js default) and rejects empty/whitespace tokens before invoking pkapi.js. Matches the import-sp assertBaseUrlIsSafe pattern — HTTPS is required for non-loopback hosts; http:// is permitted only for localhost/127.0.0.1/::1 for local dev. Also rejects malformed URLs and non-http(s) protocol schemes (ftp://, file://, etc.) that would otherwise slip past the pkapi.js Authorization header.

Added 8 unit tests in **tests**/sources/pk-api-source.test.ts covering: https://, http://localhost, http://127.0.0.1, http://remote (rejected), ftp:// (rejected), malformed URL (rejected), empty token, whitespace token.
