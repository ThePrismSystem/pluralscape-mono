---
# ps-urwj
title: Document biometricEnabled field duplication in settings
status: completed
type: task
priority: low
created_at: 2026-04-06T00:53:47Z
updated_at: 2026-04-06T09:45:50Z
parent: ps-y621
---

biometricEnabled exists as both a top-level DB column in system_settings and nested inside AppLockConfig type. The DB column is a server-side cache of the encrypted value. Duplication could confuse contributors.

Fix: add JSDoc comment on the DB column explaining the relationship to the encrypted blob field.

Audit ref: Pass 8 LOW

## Summary of Changes

Added JSDoc on biometric_enabled column in system-settings.ts explaining it's a server-side cache of the encrypted AppLockConfig value for zero-knowledge device-transfer policies.
