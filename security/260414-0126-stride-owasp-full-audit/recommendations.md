# Recommendations — Pluralscape Full Audit

**Date:** 2026-04-14
**Priority-ordered mitigations for all findings.**

---

## Priority 1 — Medium (Fix This Sprint)

### 1. Add Per-System Quotas for Notes and Innerworld Entities

**Finding:** [Missing Per-System Quotas](./findings.md#finding-1)
**Effort:** ~1 hour
**Approach:** Follow the existing `maxPerSystem` pattern from the hierarchy service factory.

For `note.service.ts`:

```typescript
const MAX_NOTES_PER_SYSTEM = 10_000;

// In createNote(), before insert:
const [existing] = await tx
  .select({ count: count() })
  .from(notes)
  .where(and(eq(notes.systemId, systemId), eq(notes.archived, false)));

if ((existing?.count ?? 0) >= MAX_NOTES_PER_SYSTEM) {
  throw new ApiHttpError(
    HTTP_TOO_MANY_REQUESTS,
    "QUOTA_EXCEEDED",
    `Maximum of ${String(MAX_NOTES_PER_SYSTEM)} notes per system`,
  );
}
```

For innerworld entities — if they use the hierarchy service factory, add `maxPerSystem` to the config:

```typescript
// innerworld-entity.service.ts config
maxPerSystem: 500,
// innerworld-region.service.ts config
maxPerSystem: 100,
// innerworld-canvas.service.ts config
maxPerSystem: 50,
```

### 2. Add File Size Limit for SP Import Parser

**Finding:** [Import Parser Memory DoS](./findings.md#finding-2)
**Effort:** ~30 minutes
**Approach:** Add a maximum file size check before parsing begins.

```typescript
// packages/import-sp/src/sources/file-source.ts
const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

async function parseStream(): Promise<PrescanState> {
  if (prescan !== null) return prescan;

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parser = clarinet.parser();
  let totalBytes = 0;

  // ... in the read loop:
  const { done, value } = await reader.read();
  if (done) break;
  totalBytes += value.byteLength;
  if (totalBytes > MAX_IMPORT_FILE_BYTES) {
    throw new FileSourceParseError(
      `Import file exceeds maximum size of ${String(MAX_IMPORT_FILE_BYTES)} bytes`,
      null,
    );
  }
  // ...
}
```

---

## Priority 2 — Low (Plan for Next Sprint)

### 3. Document Valkey Requirement for Multi-Instance Production

**Finding:** [In-Memory Stores Not Shared](./findings.md#finding-3)
**Effort:** ~15 minutes
**Approach:** Add a startup warning and deployment documentation.

```typescript
// apps/api/src/index.ts — at startup, after Valkey connection attempt
if (!valkeyConnected && env.NODE_ENV === "production") {
  logger.warn(
    "Valkey is not available. Rate limiting and login throttling use in-memory stores. " +
      "In multi-instance deployments, this allows rate limit bypass via request distribution. " +
      "Configure VALKEY_URL for production deployments.",
  );
}
```

### 4. Sanitize Error Messages in Mobile Data Layer

**Finding:** [Error Message Leakage](./findings.md#finding-4)
**Effort:** ~30 minutes
**Approach:** Replace raw JSON stringification with structured error class.

```typescript
// packages/data/src/rest-query-factory.ts
class ApiClientError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
  }
}

// Replace:
// throw new Error(`API error on ${path}: ${JSON.stringify(result.error)}`);
// With:
throw new ApiClientError(result.error.code ?? "UNKNOWN", result.error.message ?? "Request failed");
```

---

## Priority 3 — Info (Backlog / No Action Required)

### 5. Session lastActive TOCTOU — No Action Required

**Finding:** [Session lastActive TOCTOU](./findings.md#finding-5)
Accepted design trade-off. The one-request grace period on idle timeout is negligible.

### 6. Queue Job Payload Integrity — No Action Required

**Finding:** [Queue Job Integrity](./findings.md#finding-6)
Database access control is sufficient protection. Consider if queue is ever exposed beyond trusted boundary.

### 7. Webhook HMAC Documentation — Low Effort

**Finding:** [Webhook Timing-Safe Comparison](./findings.md#finding-7)
Add a note to webhook documentation recommending `crypto.timingSafeEqual()` for signature verification.
