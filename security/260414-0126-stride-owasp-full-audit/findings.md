# Findings — Pluralscape Full Audit

**Date:** 2026-04-14
**Total Findings:** 7 (0 Critical, 0 High, 2 Medium, 2 Low, 3 Info)

---

## [MEDIUM] Finding 1: Missing Per-System Quotas for Notes and Innerworld Entities {#finding-1}

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service
- **Location:** `apps/api/src/services/note.service.ts`, `apps/api/src/services/innerworld-entity.service.ts`, `apps/api/src/services/innerworld-region.service.ts`, `apps/api/src/services/innerworld-canvas.service.ts`
- **Confidence:** Confirmed
- **History:** Partial recurrence of previous Finding 6 (resource quotas added for most entities, but notes/innerworld missed)

**Description:** Most entity types enforce per-system quotas via the `maxPerSystem` configuration in the hierarchy service factory (members: 5,000; groups: 200; custom fronts: 200; channels: 50; buckets: 50; photos: 500; webhooks: 25; field definitions: 200). However, notes and innerworld entities (entities, regions, canvases) have no `maxPerSystem` or equivalent quota check. An authenticated user could create unbounded numbers of these entities, consuming database storage and degrading sync performance.

**Attack Scenario:**

1. Attacker creates an account and authenticates
2. Script creates notes in a loop (no quota check in `note.service.ts`)
3. Database grows unboundedly, sync payload size increases
4. Storage costs increase; other users experience degraded sync performance

**Code Evidence:**

```typescript
// apps/api/src/services/note.service.ts — no maxPerSystem or quota check
// Compare with services that DO have quotas:
// apps/api/src/services/group.service.ts:107 — maxPerSystem: MAX_GROUPS_PER_SYSTEM
// apps/api/src/services/member.service.ts:46 — MAX_MEMBERS_PER_SYSTEM = 5_000
```

```typescript
// apps/api/src/services/innerworld-entity.service.ts — no quota check
// apps/api/src/services/innerworld-region.service.ts — no quota check
// apps/api/src/services/innerworld-canvas.service.ts — no quota check
```

**Mitigation:** Add per-system quotas for notes and innerworld entities, consistent with the existing pattern:

```typescript
// note.service.ts
const MAX_NOTES_PER_SYSTEM = 10_000;
// Add quota check in createNote() before insert

// innerworld-entity.service.ts
const MAX_INNERWORLD_ENTITIES_PER_SYSTEM = 500;
// Add maxPerSystem to hierarchy config if using factory pattern
```

**References:** CWE-770 (Allocation of Resources Without Limits or Throttling)

---

## [MEDIUM] Finding 2: Import Parser Full Document Materialization (Memory DoS) {#finding-2}

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service
- **Location:** `packages/import-sp/src/sources/file-source.ts:17-22`
- **Confidence:** Confirmed (documented in source code comments)
- **History:** New

**Description:** The SP import file source uses clarinet SAX-style parsing but reconstructs the full document tree in memory before `iterate()` is called. Peak resident memory is approximately 2-3x the input file size. The code comments acknowledge this limitation and describe a future streaming optimization. There is no maximum file size enforced at the parser level.

**Attack Scenario:**

1. Authenticated user initiates an SP import with a crafted large JSON file (e.g., 500 MB)
2. `parseStream()` materializes the entire document tree (~1-1.5 GB RAM)
3. Server runs out of memory or triggers OS OOM killer
4. Other users' requests fail during the memory pressure window

**Code Evidence:**

```typescript
// packages/import-sp/src/sources/file-source.ts:17-22 (comments)
// Memory characteristics: despite the SAX parser, the prescan pass
// reconstructs the full SP document tree in memory (documentsByCollection
// holds every collection element as a plain object) before iterate() is
// first called. Peak resident memory is therefore O(file_size) — roughly
// 2-3x the input file size once JS object overhead is included.
```

**Mitigation:**

1. Add a maximum file size check before parsing begins (e.g., 100 MB)
2. Consider the documented streaming optimization (bounded queue, yield documents as they close)
3. Run import processing in a worker with memory limits

**References:** CWE-400 (Uncontrolled Resource Consumption)

---

## [LOW] Finding 3: In-Memory Rate Limit Stores Not Shared Across Instances {#finding-3}

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service, Spoofing
- **Location:** `apps/api/src/middleware/stores/account-login-store.ts:40-115`, `apps/api/src/middleware/stores/memory-store.ts`
- **Confidence:** Confirmed
- **History:** New

**Description:** When Valkey is unavailable, both the rate limiter and the login throttle fall back to in-memory stores. These stores are process-local, so in a multi-instance deployment each instance maintains independent counters. An attacker could distribute requests across instances to multiply their effective rate limit.

**Attack Scenario:**

1. Deployment runs N API instances behind a load balancer without Valkey
2. Attacker distributes login attempts round-robin across instances
3. Effective brute force rate = N x 10 attempts per 15-minute window
4. With 5 instances: 50 attempts per 15 minutes instead of 10

**Code Evidence:**

```typescript
// apps/api/src/middleware/stores/account-login-store.ts:40
export class MemoryAccountLoginStore implements AccountLoginStore {
  private readonly store = new Map<string, LoginThrottleEntry>();
  // Per-process state — not shared across instances
}

// apps/api/src/middleware/stores/memory-store.ts
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitEntry>();
  // Per-process state — not shared across instances
}
```

**Mitigation:** This is by design (graceful degradation), but deployments should be aware that Valkey is strongly recommended for production. Options:

1. Document that Valkey is required for multi-instance production deployments
2. Add a startup warning when Valkey is unavailable in production
3. Consider a Valkey-backed `AccountLoginStore` implementation (currently only rate limit store has Valkey backend)

**References:** CWE-799 (Improper Control of Interaction Frequency)

---

## [LOW] Finding 4: Error Message Leakage in Mobile Data Layer {#finding-4}

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Information Disclosure
- **Location:** `packages/data/src/rest-query-factory.ts:58`
- **Confidence:** Likely
- **History:** New

**Description:** The mobile data layer's `rest-query-factory.ts` stringifies raw API error responses into thrown Error messages. While the API server masks 5xx errors in production, 4xx errors include structured error codes and field-level validation details. If these errors propagate to the UI or crash reporting without sanitization, they could reveal internal API structure.

**Attack Scenario:**

1. Attacker uses the mobile app to trigger various API errors
2. Error messages in the app (or crash reports) include `API error on /v1/...: {"error":{"code":"...","details":[...]}}`
3. Attacker maps internal API structure, validation rules, and error codes

**Code Evidence:**

```typescript
// packages/data/src/rest-query-factory.ts:58
throw new Error(`API error on ${path}: ${JSON.stringify(result.error)}`);
```

**Mitigation:** Sanitize error messages before user-facing display:

```typescript
// Throw structured error instead of raw JSON
throw new ApiClientError(result.error.code, result.error.message);
// Let UI layer decide what to show
```

**References:** CWE-209 (Generation of Error Message Containing Sensitive Information)

---

## [INFO] Finding 5: Session lastActive Fire-and-Forget TOCTOU {#finding-5}

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Tampering
- **Location:** `apps/api/src/middleware/auth.ts:86-102`
- **Confidence:** Possible
- **History:** Recurring (previous audit Finding 8 — accepted design trade-off)

**Description:** The `lastActive` timestamp update is fire-and-forget (async, non-blocking). Between validation and the update completing, concurrent requests could see a stale `lastActive` value, potentially allowing a session that should have timed out to remain valid for one additional request.

**Impact:** Minimal — one-request grace period on idle timeout. The `LAST_ACTIVE_THROTTLE_MS` (300ms) makes the window extremely narrow.

**Mitigation:** No action required. Accepted design trade-off (performance vs precision).

**References:** CWE-367 (Time-of-check Time-of-use Race Condition)

---

## [INFO] Finding 6: Queue Job Payloads Lack Integrity Verification {#finding-6}

- **OWASP:** A08 — Software and Data Integrity Failures
- **STRIDE:** Tampering
- **Location:** `packages/queue/src/types.ts:11-25`
- **Confidence:** Possible
- **History:** New

**Description:** Job payloads in the queue system have no HMAC or signature for integrity verification. A malicious actor with database write access could inject arbitrary jobs into the queue. The risk is mitigated by the fact that database access is protected by RLS and network controls.

**Impact:** Very low — requires direct database write access, which implies a more severe compromise.

**Mitigation:** No action required for current threat model. Consider adding payload signing if the queue is ever exposed beyond the trusted database boundary.

**References:** CWE-345 (Insufficient Verification of Data Authenticity)

---

## [INFO] Finding 7: Webhook HMAC Timing-Safe Comparison Not Documented {#finding-7}

- **OWASP:** A02 — Cryptographic Failures
- **STRIDE:** Spoofing
- **Location:** `apps/api/src/services/webhook-delivery-worker.ts:64-72` (server-side HMAC is correct)
- **Confidence:** Possible
- **History:** New

**Description:** The server correctly generates HMAC-SHA256 signatures for webhook payloads using `createHmac().update().digest()`. However, webhook recipients (external systems) must implement timing-safe comparison when verifying signatures. Without documentation guidance, recipients may use naive string comparison, which is vulnerable to timing attacks.

**Impact:** This is external code outside Pluralscape's control. The risk is that a webhook recipient's verification could be bypassed via timing side-channel.

**Mitigation:** Add webhook integration documentation recommending `crypto.timingSafeEqual()` (Node.js) or equivalent for signature verification.

**References:** CWE-208 (Observable Timing Discrepancy)
