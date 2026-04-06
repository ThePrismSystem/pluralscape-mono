---
# ps-5qw5
title: Security audit remediation
status: completed
type: task
priority: normal
created_at: 2026-04-06T14:02:50Z
updated_at: 2026-04-06T14:43:15Z
---

Implement 5 confirmed findings from the STRIDE+OWASP security audit.\n\n- [x] Task 1: Enforce SMTP TLS in production\n- [x] Task 2: Tighten CSP to default-src 'none'\n- [x] Task 3: API key authentication middleware\n- [x] Task 4: Recovery key per-account rate limiting\n- [x] Tasks 5-6: Resource quotas (hierarchy factory + groups)\n- [x] Tasks 7-9: Resource quotas (members, custom fronts, channels)\n- [x] Task 10: Update existing limits (buckets, photos)\n- [x] Task 11: Create M11 follow-up bean\n- [x] Task 12: Full verification

## Summary of Changes

Implemented 5 security audit remediation items:

1. **SMTP TLS enforcement** — runtime guard refuses to start with plaintext SMTP in production
2. **CSP tightened** — default-src 'none' with base-uri and form-action 'none'
3. **API key auth middleware** — ps\_ prefixed tokens, dual-path auth, scoped AuthContext
4. **Recovery key per-account rate limit** — 3/hour keyed by email hash
5. **Resource quotas** — members (5000), groups (200), custom fronts (200), channels (50), buckets (50), photos (5/member + 500/system)

Also created follow-up bean api-u998 for per-endpoint API key scope enforcement (M11).
Corrected 2 false positives in audit report (webhook DNS rebinding, session revocation audit).
