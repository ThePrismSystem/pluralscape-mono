---
# mobile-e3l7
title: "Audit remediation: apps/mobile (2026-04-20)"
status: completed
type: epic
priority: critical
created_at: 2026-04-20T09:20:30Z
updated_at: 2026-04-20T19:01:36Z
parent: ps-h2gl
---

Remediation from comprehensive audit 2026-04-20. 1 Critical (plaintext HTTP fallback) + 4 High. See docs/local-audits/comprehensive-audit-2026-04-20/mobile.md. Tracking: ps-g937.

## Summary of Changes

Landed all 5 high-priority findings from the apps/mobile audit:

- mobile-c01j (CRIT): removed hardcoded http://localhost:3000 from app.json. Per-profile apiBaseUrl now ships via eas.json extras (dev/preview/production). Loader throws on missing values and rejects http:// in non-dev builds or on non-loopback hosts.
- mobile-scko: SP token SecureStore operations now pass WHEN_UNLOCKED_THIS_DEVICE_ONLY for parity across read/write/delete, blocking iCloud sync and keeping the token unreadable while the device is locked.
- mobile-h89l: hoisted AsyncStorageI18nCache and createChainedBackend out of the locale-keyed useMemo into module-scope singletons.
- mobile-79vz: document-level invalidation narrows hot-path tables to list-shaped queries via a predicate, preserving broad invalidation for non-hot-path tables.
- mobile-76ql: search:index-updated invalidation now predicate-matches by scope so self-scope events do not purge friend search caches (and vice versa).
