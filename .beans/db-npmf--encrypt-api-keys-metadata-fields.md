---
# db-npmf
title: Encrypt api_keys metadata fields
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:40:19Z
parent: db-2nr7
---

api_keys.name, scopes, scopedBucketIds are all plaintext. Reveals integration details to server operator. Ref: audit M11
