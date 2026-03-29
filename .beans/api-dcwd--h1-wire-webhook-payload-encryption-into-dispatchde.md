---
# api-dcwd
title: "H1: Wire webhook payload encryption into dispatch/delivery path"
status: completed
type: task
created_at: 2026-03-29T09:52:35Z
updated_at: 2026-03-29T09:52:35Z
parent: api-hvub
---

encryptWebhookPayload existed but was never called. Rewritten to XChaCha20-Poly1305 and wired into dispatch/delivery. Fixed in PR #319.
