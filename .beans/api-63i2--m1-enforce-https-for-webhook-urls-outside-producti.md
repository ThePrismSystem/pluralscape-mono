---
# api-63i2
title: 'M1: Enforce HTTPS for webhook URLs outside production'
status: todo
type: task
created_at: 2026-03-29T09:52:47Z
updated_at: 2026-03-29T09:52:47Z
parent: api-hvub
---

webhook-config.service.ts:131 — HTTPS enforcement gated by NODE_ENV === production. Staging deployments accept HTTP URLs, allowing plaintext secret transmission.
