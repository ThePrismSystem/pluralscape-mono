---
# api-2wjc
title: Validate locale/namespace params in Crowdin CDN routes
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T11:58:30Z
parent: api-v8zu
---

Finding [H1] from audit 2026-04-20. apps/api/src/services/crowdin-ota.service.ts:133, apps/api/src/routes/i18n/namespace.ts:36-37. No path-traversal guard on locale/namespace — allows .. segments into CDN URL. Fix: validate locale against [a-zA-Z]{2,3}(-[a-zA-Z]{2,4})? and namespace against [a-zA-Z0-9_-]+.

## Summary of Changes

Added colocated LocaleSchema/NamespaceSchema validators (BCP-47-ish locale regex, filesystem-safe namespace regex) under apps/api/src/routes/i18n/schemas.ts. Wired into the Hono route handler (400 VALIDATION_ERROR) and the tRPC procedure (replacing the loose z.string().min(2) input). Crowdin OTA service now calls assertSafeLocaleAndNamespace as belt-and-braces before URL interpolation. Added unit tests for the schemas plus route-level path-traversal regression cases.
