# Findings — Pluralscape Full Audit

**Date:** 2026-04-06
**Total Findings:** 7 (0 Critical, 1 High, 2 Medium, 2 Low, 2 Info)

---

## [HIGH] Finding 1: SMTP Plaintext Email in Production {#finding-1} — FIXED

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/env.ts:74-77`
- **Confidence:** Confirmed

**Description:** `SMTP_SECURE` defaults to `"0"` (plaintext) and has no production enforcement. Unlike `EMAIL_HASH_PEPPER` and `EMAIL_ENCRYPTION_KEY` which use Zod `.refine()` to require values in production, SMTP security is entirely opt-in. If a self-hosted deployment uses SMTP without explicitly setting `SMTP_SECURE=1`, password reset emails, security notifications, and new-device alerts are sent over plaintext SMTP.

**Attack Scenario:**

1. Self-hosted Pluralscape instance configured with SMTP but `SMTP_SECURE` left at default
2. Attacker on same network segment performs passive traffic capture
3. Password reset email captured in plaintext, containing recovery key or reset link
4. Attacker uses captured credentials for account takeover

**Code Evidence:**

```typescript
// apps/api/src/env.ts:74-77
SMTP_SECURE: z
  .enum(["0", "1"])
  .default("0")
  .transform((v) => v === "1"),
```

Compare with enforced secrets (same file):

```typescript
// EMAIL_HASH_PEPPER and EMAIL_ENCRYPTION_KEY have .refine() for production
```

**Mitigation:**

```typescript
SMTP_SECURE: z
  .enum(["0", "1"])
  .default("0")
  .transform((v) => v === "1"),
// Add after createEnv():
// .refine((env) => !isProduction || env.EMAIL_PROVIDER !== "smtp" || env.SMTP_SECURE, {
//   message: "SMTP_SECURE must be '1' in production when using SMTP provider",
// })
```

**References:** CWE-319 (Cleartext Transmission of Sensitive Information)

---

## [MEDIUM] Finding 2: Incomplete Content Security Policy {#finding-2} — FIXED

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/middleware/secure-headers.ts:15-34`
- **Confidence:** Confirmed

**Description:** The Content-Security-Policy header only sets `default-src 'self'` and `frame-ancestors 'none'`. While this is a reasonable baseline for a pure API server, the CSP lacks `form-action`, `upgrade-insecure-requests`, and `base-uri` directives that would further harden the policy.

**Code Evidence:**

```typescript
// apps/api/src/middleware/secure-headers.ts
"Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'"
```

**Mitigation:**

```typescript
"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'; upgrade-insecure-requests"
```

Note: Since this is a pure API (no HTML responses), `default-src 'none'` is more appropriate than `'self'`.

**References:** CWE-1021 (Improper Restriction of Rendered UI Layers)

---

## [MEDIUM] Finding 3: Webhook DNS Rebinding TOCTOU {#finding-3} — FALSE POSITIVE

- **OWASP:** A10 — Server-Side Request Forgery
- **STRIDE:** Tampering
- **Location:** `apps/api/src/jobs/webhook-deliver.ts`, `apps/api/src/lib/ip-validation.ts:312-341`
- **Confidence:** Likely

**Description:** Webhook URL validation resolves DNS and checks the resolved IP against blocked ranges (loopback, private, link-local, CGNAT, metadata) at webhook creation time. However, the actual HTTP delivery in the webhook worker does NOT use IP pinning — it resolves DNS independently. A sophisticated attacker could configure DNS to return a safe IP during validation, then rebind to an internal IP before delivery.

**Attack Scenario:**

1. Attacker registers webhook with URL pointing to their controlled domain
2. During validation, DNS resolves to attacker's public IP (passes validation)
3. Attacker updates DNS to resolve to `169.254.169.254` (cloud metadata) or `10.0.0.1` (internal)
4. Webhook delivery resolves DNS again, hitting the internal service
5. Attacker receives internal service response via webhook payload

**Code Evidence:**

- Validation: `apps/api/src/lib/ip-validation.ts:312-341` — resolves DNS, blocks private IPs
- Delivery: `apps/api/src/jobs/webhook-deliver.ts` — standard `fetch()` without IP pinning
- IP pinning utility EXISTS: `buildIpPinnedFetchArgs` in `ip-validation.ts` but is not used in delivery

**Mitigation:** Use `buildIpPinnedFetchArgs` in the webhook delivery worker to pin the resolved IP at delivery time:

```typescript
const { url, init } = await buildIpPinnedFetchArgs(webhookUrl);
const response = await fetch(url, { ...init, method: "POST", body, headers });
```

**References:** CWE-918 (Server-Side Request Forgery), CWE-350 (Reliance on Reverse DNS)

---

## [MEDIUM] Finding 4: API Key Authentication Not Implemented {#finding-4} — FIXED

- **OWASP:** A01 — Broken Access Control
- **STRIDE:** Elevation of Privilege
- **Location:** `apps/api/src/middleware/auth.ts`
- **Confidence:** Confirmed

**Description:** The `apiKeys` database table exists with full CRUD operations (creation, listing, revocation, scope management) via `api-key.service.ts`, including `ApiKeyScope` types. However, the auth middleware only handles Bearer session tokens. There is no middleware to authenticate requests using API keys or enforce their scopes.

This means API keys can be created and managed but serve no actual authentication purpose — they cannot be used to access any endpoint. If any documentation or client code expects API key authentication, it silently fails to authenticate.

**Code Evidence:**

```typescript
// apps/api/src/middleware/auth.ts — only handles Bearer session tokens
const match = authorization?.match(/^Bearer\s+(.+)$/i);
// No API key format handling (e.g., "ApiKey sk_..." or "X-API-Key" header)
```

**Impact:** Low immediate risk (no auth bypass since keys simply don't work), but represents incomplete feature with potential for future confusion. If a user creates an API key expecting it to grant access, they'll get 401 on every request.

**Mitigation:** Either implement API key authentication middleware or remove the API key management endpoints to avoid confusion.

**References:** CWE-306 (Missing Authentication for Critical Function)

---

## [LOW] Finding 5: Coarse-Grained Recovery Key Rate Limiting {#finding-5} — FIXED

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Spoofing
- **Location:** `apps/api/src/services/recovery-key.service.ts:196`
- **Confidence:** Likely

**Description:** Recovery key password reset uses the global `authHeavy` rate limiter (shared with login). There is no per-account throttle on recovery key attempts. While the recovery key itself has high entropy (52 characters), a distributed attacker could attempt recovery key resets across many accounts without triggering per-account limits.

**Mitigation:** Add per-account rate limiting on recovery key attempts (e.g., 3 attempts per hour per account, independent of login rate limit).

**References:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)

---

## [LOW] Finding 6: No Resource Quotas for Core Entities {#finding-6} — FIXED

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service
- **Location:** `apps/api/src/services/`
- **Confidence:** Confirmed

**Description:** Several core entity types have no per-system creation limits:

- Members (no limit found)
- Groups (no limit found)
- Custom fronts (no limit found)
- Journal entries (no limit found)
- Wiki pages (no limit found)

Other entities do have quotas: webhooks (25), field definitions (200), friend codes (10), buckets (100), photos (50), sessions (50).

**Impact:** A malicious or compromised account could create millions of entities, consuming database and sync storage.

**Mitigation:** Add per-system quotas for members, groups, custom fronts, and other unbounded entity types.

**References:** CWE-770 (Allocation of Resources Without Limits)

---

## [INFO] Finding 7: Missing Session Revocation Audit Event {#finding-7} — FALSE POSITIVE

- **OWASP:** A09 — Security Logging and Monitoring Failures
- **STRIDE:** Repudiation
- **Location:** `packages/types/src/audit-log.ts`
- **Confidence:** Possible

**Description:** The audit log event types include `auth.login`, `auth.logout`, `auth.password-changed`, `auth.recovery-key-used`, but no explicit `auth.session-revoked` event for when a user manually revokes a specific session. Session revocation is only indirectly covered by the password-change flow (which revokes all sessions).

**Mitigation:** Add `auth.session-revoked` event type to the audit log schema.

**References:** CWE-778 (Insufficient Logging)

---

## [INFO] Finding 8: Session lastActive TOCTOU {#finding-8}

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Tampering
- **Location:** `apps/api/src/middleware/auth.ts:56`
- **Confidence:** Possible

**Description:** The `lastActive` timestamp update on session validation is fire-and-forget (async, non-blocking). Between validation and the update completing, concurrent requests could see a stale `lastActive` value, potentially allowing a session that should have timed out to remain valid for one additional request.

**Impact:** Minimal — no authorization bypass, only a potential one-request grace period on idle timeout. The 5-minute throttle on updates makes the window extremely narrow.

**Mitigation:** No action required. The design trade-off (performance vs precision) is acceptable for idle timeout enforcement.

**References:** CWE-367 (Time-of-check Time-of-use Race Condition)
