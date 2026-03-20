---
# api-b7wa
title: Increase password hashing to OWASP Sensitive parameters
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T10:22:34Z
parent: api-765x
---

M11: Upgrade Argon2id parameters to OWASP 'Sensitive' tier (m=65536, t=4, p=1 minimum).

## Acceptance Criteria

- Argon2id parameters set to minimum: m=65536 (64MB), t=4 (iterations), p=1 (parallelism)
- Parameters defined in crypto constants file with JSDoc
- Backward compatibility: existing hashes with old params still verify on login
- Re-hash on successful login if hash uses old params (transparent upgrade)
- Unit tests: verify new params used for new hashes; verify old hashes still verify

## Summary of Changes

- Added PWHASH_OPSLIMIT_SENSITIVE = 4 to crypto.constants.ts
- Updated server profile in master-key.ts: opsLimit 3 -> 4 (OWASP Sensitive)
- Updated DUMMY_ARGON2_HASH to t=4 in auth.constants.ts
- Added needsRehash() helper parsing t= param from argon2id hash string
- Added fire-and-forget rehash on login when existing hash uses old params
- Added unit tests for needsRehash with various t= values
