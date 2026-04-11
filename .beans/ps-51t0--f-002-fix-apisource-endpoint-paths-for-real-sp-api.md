---
# ps-51t0
title: "F-002: Fix ApiSource ENDPOINT_PATHS for real SP API"
status: completed
type: bug
priority: critical
created_at: 2026-04-10T21:05:28Z
updated_at: 2026-04-11T21:31:10Z
parent: ps-n0tq
---

ENDPOINT_PATHS in api-source.ts:49-65 do not match the real SP API. Multiple paths need :system params, chat endpoints are under /v1/chat/, comments/notes need compound params, and pagination uses limit/offset but SP streams full collections. Blocking for live API import.

## Summary of Changes

Rewrote `api-source.ts` to match real SP API (verified against upstream ApparyllisOrg/SimplyPluralApi routes.ts).

- Added `systemId` to `ApiSourceInput` and substituted `:system` in path templates.
- Replaced flat `ENDPOINT_PATHS` with a strategy map (`list`/`single`/`range`/`unsupported`):
  - `users`: single GET `/v1/user/:system`
  - `private`: single GET `/v1/user/private/:system`
  - `privacyBuckets`: list GET `/v1/privacyBuckets` (no :system)
  - `customFields`: list `/v1/customFields/:system`
  - `frontStatuses`: list `/v1/customFronts/:system`
  - `members`, `groups`, `polls`: list `/v1/<name>/:system`
  - `frontHistory`: range fetch `/v1/frontHistory/:system?startTime=0&endTime=<now>`
  - `channels`, `channelCategories`: list `/v1/chat/channels` and `/v1/chat/categories` under /v1/chat/ (no :system)
  - `comments`, `notes`, `chatMessages`, `boardMessages`: marked unsupported (no bulk endpoint; require per-parent traversal)
- Removed the incorrect offset-based pagination loop — SP streams full collections in a single response.
- `listCollections()` returns only fetchable collections (unsupported ones are omitted).
- Added empty-body handling for single-doc responses.
- Rewrote `api-source.test.ts` to cover every strategy.
