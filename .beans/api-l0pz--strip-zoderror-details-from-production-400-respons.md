---
# api-l0pz
title: Strip ZodError details from production 400 responses
status: completed
type: bug
priority: high
created_at: 2026-03-17T11:58:33Z
updated_at: 2026-03-17T18:31:28Z
parent: api-tspr
---

## Security Finding

**Severity:** Medium | **OWASP:** A05 Security Misconfiguration | **STRIDE:** Information Disclosure
**Confidence:** Confirmed | **Audit:** security/260317-1144-stride-owasp-full-audit/findings.md#finding-1

## Problem

The global error handler at `apps/api/src/middleware/error-handler.ts:84-92` passes the full ZodError object as `details` in 400 responses. Production masking (line 51) only applies to 5xx errors (`status >= HTTP_INTERNAL_SERVER_ERROR`), so validation error details — including field names, type constraints, and validation rules — are returned to clients even in production.

```typescript
// Line 82-93 — details leak
if (err instanceof Error && err.name === "ZodError") {
  return formatError(
    c,
    HTTP_BAD_REQUEST,
    "VALIDATION_ERROR",
    "Validation failed",
    requestId,
    isProduction,
    err,
  );
  //                                                                                                      ^^^ full ZodError
}
```

## Attack Scenario

1. Attacker sends malformed JSON to any validated endpoint
2. ZodError response reveals field names, types, min/max constraints
3. Attacker maps all validation schemas without source code access

## Fix

Pass `undefined` as details when `isProduction` is true:

```typescript
if (err instanceof Error && err.name === "ZodError") {
  return formatError(
    c,
    HTTP_BAD_REQUEST,
    "VALIDATION_ERROR",
    "Validation failed",
    requestId,
    isProduction,
    isProduction ? undefined : err,
  );
}
```

## Checklist

- [ ] Conditionally strip ZodError details in production
- [ ] Add integration test: verify 400 response has no `details` when NODE_ENV=production
- [ ] Verify existing error handler tests still pass

## References

- CWE-209: Generation of Error Message Containing Sensitive Information

## Summary of Changes\n\nPassed `undefined` instead of `err` as the details arg to `formatError` when `isProduction` is true for ZodError handling. Added integration tests verifying details are stripped in production and present in development.
