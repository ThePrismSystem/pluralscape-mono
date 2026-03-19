---
# api-htya
title: Per-account email salting in hash
status: todo
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-19T11:39:42Z
parent: api-765x
---

M10: Use per-account salts in email hashing instead of a global salt to improve resistance to rainbow table attacks.

## Acceptance Criteria

- Each account has a unique cryptographically random salt for email hashing
- Hash computed as hash(email || account_salt) instead of hash(email || global_salt)
- Migration script generates salts for existing accounts and rehashes emails
- Same email on different accounts produces different hashes
- Integration tests: create two accounts with same email domain, verify different hashes; migration test
