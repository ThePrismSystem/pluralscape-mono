---
# db-kcmt
title: Re-evaluate audit_log.detail encryption tier (T1 vs T3)
status: draft
type: task
priority: deferred
created_at: 2026-03-12T18:50:28Z
updated_at: 2026-03-21T10:15:55Z
parent: ps-6itw
---

The audit_log.detail column is currently T3 (server-readable plaintext) for security monitoring purposes (failed login detection, IP pattern analysis). This was a provisional decision made during audit 004 fixes. Re-evaluate whether detail should be T1 (zero-knowledge E2E encrypted) or remain T3 at epic completion. Consider: What detail strings will the API actually write? Can security monitoring work with encrypted detail? What's the privacy impact of server-readable audit details?
