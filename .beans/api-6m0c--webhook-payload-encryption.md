---
# api-6m0c
title: Webhook payload encryption
status: completed
type: feature
priority: low
created_at: 2026-03-29T02:07:31Z
updated_at: 2026-03-29T07:00:31Z
parent: api-9wze
---

When cryptoKeyId is set on a webhook config, encrypt the payload using the referenced key before delivery. Schema columns (crypto_key_id, encrypted_data) already exist.

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes\n\nImplemented in PR #313: webhook payload encryption when crypto_key_id is set on config.
