---
# api-j0se
title: Queue job payloads lack integrity verification
status: completed
type: task
priority: deferred
created_at: 2026-04-14T06:40:06Z
updated_at: 2026-04-14T06:52:35Z
parent: ps-9ujv
---

**Finding 6 (Info)** — OWASP A08, STRIDE Tampering

Job payloads in the queue system have no HMAC or signature. A malicious actor with DB write access could inject arbitrary jobs. Mitigated by RLS and network controls.

**Status:** No action required for current threat model. Reconsider if queue is ever exposed beyond the trusted database boundary.

Reference: security/260414-0126-stride-owasp-full-audit/findings.md#finding-6

## Summary of Changes

Accepted by design — no code changes required.

Jobs are enqueued only through `JobQueue.enqueue()` from authenticated API route handlers. Injection requires direct Redis write access, which implies full system compromise already. Adding HMAC signatures would not raise the security bar beyond existing DB/network controls.
