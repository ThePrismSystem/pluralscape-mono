---
# api-si8q
title: Session lastActive fire-and-forget TOCTOU (accepted)
status: completed
type: task
priority: deferred
created_at: 2026-04-14T06:40:03Z
updated_at: 2026-04-14T06:52:34Z
parent: ps-9ujv
---

**Finding 5 (Info)** — OWASP A07, STRIDE Tampering

The lastActive timestamp update in auth middleware is fire-and-forget. Concurrent requests could see stale values, allowing one additional request past idle timeout. Recurring finding from previous audit.

**Status:** Accepted design trade-off. No action required — the LAST_ACTIVE_THROTTLE_MS (300ms) window is negligible.

Reference: security/260414-0126-stride-owasp-full-audit/findings.md#finding-5

## Summary of Changes

Accepted by design — no code changes required.

The fire-and-forget timing window is 1-10ms against idle timeouts of 7 days (web) / 30 days (mobile). The theoretical one-extra-request grace period is negligible and unexploitable. The performance trade-off (non-blocking lastActive updates) is correct.
