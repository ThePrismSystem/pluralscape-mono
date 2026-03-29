---
# api-6m0c
title: Webhook payload encryption
status: todo
type: feature
priority: low
created_at: 2026-03-29T02:07:31Z
updated_at: 2026-03-29T02:08:23Z
parent: api-9wze
---

When cryptoKeyId is set on a webhook config, encrypt the payload using the referenced key before delivery. Schema columns (crypto_key_id, encrypted_data) already exist.
