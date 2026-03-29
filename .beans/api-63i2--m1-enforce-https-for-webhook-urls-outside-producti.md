---
# api-63i2
title: "M1: Enforce HTTPS for webhook URLs outside production"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:47Z
updated_at: 2026-03-29T10:31:12Z
parent: api-hvub
---

webhook-config.service.ts:131 — HTTPS enforcement gated by NODE_ENV === production. Staging deployments accept HTTP URLs, allowing plaintext secret transmission.

## Summary of Changes\n\nReplaced NODE_ENV-gated HTTPS check with universal enforcement + localhost exemption.
