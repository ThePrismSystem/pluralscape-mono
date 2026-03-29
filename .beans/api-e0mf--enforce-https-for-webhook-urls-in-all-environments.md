---
# api-e0mf
title: Enforce HTTPS for webhook URLs in all environments
status: completed
type: bug
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T12:48:12Z
parent: api-kjyg
---

webhook-config.service.ts:131 gates HTTPS enforcement behind NODE_ENV === 'production'. Staging deployments sharing a database accept HTTP URLs, allowing plaintext secret transmission. Enforce HTTPS in all non-development environments.
