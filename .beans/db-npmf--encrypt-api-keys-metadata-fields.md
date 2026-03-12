---
# db-npmf
title: Encrypt api_keys metadata fields
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T08:32:02Z
parent: db-2nr7
---

api_keys.name, scopes, scopedBucketIds are all plaintext. Reveals integration details to server operator. Ref: audit M11

## Summary of Changes

Added nullable `encrypted_data BYTEA` column to api_keys table. Made `name` nullable (was NOT NULL) to support migration to encrypted blob. Updated DDL helpers and added integration tests. Updated tier map: `ApiKey: T1 (name) | T3 (scopes, scopedBucketIds, keyType, tokenHash, timestamps, encryptedKeyMaterial)`.
