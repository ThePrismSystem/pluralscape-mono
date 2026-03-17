---
# api-xob6
title: Validate X-Forwarded-For as IP format before using as rate-limit key
status: todo
type: bug
priority: normal
created_at: 2026-03-17T11:59:41Z
updated_at: 2026-03-17T11:59:41Z
parent: api-tspr
---

## Security Finding

**Severity:** Low | **OWASP:** A05 Security Misconfiguration | **STRIDE:** Denial of Service
**Confidence:** Confirmed | **Audit:** security/260317-1144-stride-owasp-full-audit/findings.md#finding-4

## Problem

When TRUST_PROXY=1, the rate limiter (`apps/api/src/middleware/rate-limit.ts:36`) and request-meta extractor (`apps/api/src/lib/request-meta.ts:19`) accept the first comma-separated value from X-Forwarded-For without validating it as a syntactically valid IP address.

```typescript
// rate-limit.ts:35-37
const forwarded = c.req.header("x-forwarded-for");
const ip = forwarded?.split(",")[0]?.trim();
return ip && ip.length > 0 ? ip : GLOBAL_KEY;  // No IP format validation
```

An attacker can inject arbitrary strings to create unlimited rate-limit buckets (up to the 10,000 MAX_RATE_LIMIT_ENTRIES eviction threshold).

## Fix

Extract IP validation into a shared utility used by both rate-limit.ts and request-meta.ts:

```typescript
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidIp(value: string): boolean {
  return IPV4_RE.test(value) || value.includes(":");
}
```

Reject non-IP values and fall back to GLOBAL_KEY.

## Checklist

- [ ] Create shared IP validation utility
- [ ] Update rate-limit.ts getClientKey() to validate IP format
- [ ] Update request-meta.ts extractIpAddress() to validate IP format
- [ ] Add tests for invalid X-Forwarded-For values (non-IP strings, empty, garbage)
- [ ] Add test for valid IPv4 and IPv6 values

## References

- CWE-345: Insufficient Verification of Data Authenticity
