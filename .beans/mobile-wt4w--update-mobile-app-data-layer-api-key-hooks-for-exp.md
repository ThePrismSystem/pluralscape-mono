---
# mobile-wt4w
title: Update mobile app data layer API key hooks for expanded scopes
status: completed
type: task
priority: normal
created_at: 2026-04-06T18:39:41Z
updated_at: 2026-04-16T07:29:54Z
parent: ps-h2gl
blocked_by:
  - api-u998
---

Ensure the mobile app's data layer hooks for API key management (create, update, list, revoke) work with the expanded scope system from api-u998. The scope picker UI needs to present the new triplet model (read/write/delete per entity) and aggregate scopes (read-all, write-all, delete-all, full). Verify type alignment between @pluralscape/types ApiKeyScope and the mobile app.

## Summary of Changes

Audited the mobile hook type chain for expanded API key scopes (68 values). Findings:

- `RouterInput["apiKey"]["create"]` correctly infers `scopes: ApiKeyScope[]` from `CreateApiKeyBodySchema`, which uses `z.enum(ALL_API_KEY_SCOPES)`
- `RouterOutput["apiKey"]["get"]` and list items include `scopes: readonly ApiKeyScope[]`
- `@pluralscape/types` exports all scope-related types: `ApiKeyScope`, `ALL_API_KEY_SCOPES`, `SCOPE_DOMAINS`, `ScopeDomain`, `ScopeTier`
- No hook code changes needed — the tRPC inference chain handles the expanded scopes automatically
- The UI can import `ALL_API_KEY_SCOPES` and `SCOPE_DOMAINS` to build a scope picker
