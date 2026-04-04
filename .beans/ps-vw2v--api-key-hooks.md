---
# ps-vw2v
title: API key hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:11:40Z
updated_at: 2026-04-04T19:25:02Z
parent: ps-j47j
---

CRUD, scope management, last-used tracking

Uses trpc.apiKey.\* (list, get, create, revoke).

## Summary of Changes

Implemented API key data hooks following use-device-tokens.ts pattern:

- useApiKey (single query)
- useApiKeysList (paginated)
- useCreateApiKey (mutation, invalidates list)
- useRevokeApiKey (mutation, invalidates get + list)

All tests passing.
