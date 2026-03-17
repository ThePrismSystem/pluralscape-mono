---
# api-l5vs
title: Biometric token enrollment
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:52:40Z
updated_at: 2026-03-17T21:41:58Z
parent: api-o89k
blocked_by:
  - api-dcg4
---

POST /auth/biometric/enroll (register biometric token for current session/device). POST /auth/biometric/verify (validate token, refresh session). References biometricEnabled in system settings.

## Summary of Changes

- Added biometric_tokens DB table with BLAKE2b token hashing
- POST /auth/biometric/enroll and /verify endpoints with authHeavy rate limiting
- Guard on systemSettings.biometricEnabled before enrollment
- BiometricTokenId type, bt\_ prefix, new audit events
- Shared validation schemas, PIN crypto, API error codes for all M2 beans
