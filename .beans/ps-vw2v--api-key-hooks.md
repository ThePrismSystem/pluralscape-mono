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

Uses trpc.apiKey.\* (list, get, create, update, delete, rotate).

## Summary of Changes\n\nImplemented API key data hooks following use-device-tokens.ts pattern:\n- useApiKey (single query)\n- useApiKeysList (paginated)\n- useCreateApiKey (mutation, invalidates list)\n- useRevokeApiKey (mutation, invalidates get + list)\n\nAll tests passing.
