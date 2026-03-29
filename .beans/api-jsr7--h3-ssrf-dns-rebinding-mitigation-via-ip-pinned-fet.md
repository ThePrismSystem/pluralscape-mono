---
# api-jsr7
title: 'H3: SSRF DNS rebinding mitigation via IP-pinned fetch'
status: completed
type: task
created_at: 2026-03-29T09:52:35Z
updated_at: 2026-03-29T09:52:35Z
parent: api-hvub
---

DNS resolved for validation then fetch() resolved again independently. Added IP-pinned fetch in delivery worker. Fixed in PR #319.
