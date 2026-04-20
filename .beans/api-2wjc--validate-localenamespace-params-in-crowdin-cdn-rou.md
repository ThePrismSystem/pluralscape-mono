---
# api-2wjc
title: Validate locale/namespace params in Crowdin CDN routes
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Finding [H1] from audit 2026-04-20. apps/api/src/services/crowdin-ota.service.ts:133, apps/api/src/routes/i18n/namespace.ts:36-37. No path-traversal guard on locale/namespace — allows .. segments into CDN URL. Fix: validate locale against [a-zA-Z]{2,3}(-[a-zA-Z]{2,4})? and namespace against [a-zA-Z0-9_-]+.
