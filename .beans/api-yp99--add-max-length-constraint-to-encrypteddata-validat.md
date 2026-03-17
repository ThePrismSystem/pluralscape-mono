---
# api-yp99
title: Add max length constraint to encryptedData validation schema
status: todo
type: bug
priority: high
created_at: 2026-03-17T11:58:44Z
updated_at: 2026-03-17T11:58:44Z
parent: api-tspr
---

## Security Finding

**Severity:** Medium | **OWASP:** A03 Injection (resource exhaustion) | **STRIDE:** Tampering
**Confidence:** Confirmed | **Audit:** security/260317-1144-stride-owasp-full-audit/findings.md#finding-2

## Problem

`packages/validation/src/system.ts:5` defines `encryptedData: z.string().min(1)` with no `.max()` constraint. While the global body limit (256 KiB) prevents extremely large payloads, a single field could consume most of that budget. Per-field validation catches oversized encrypted payloads earlier and provides clearer errors. If body limits are ever raised for other endpoints, this field remains unprotected.

```typescript
// packages/validation/src/system.ts:3-8
export const UpdateSystemBodySchema = z
  .object({
    encryptedData: z.string().min(1),  // No .max()
    version: z.int().min(1),
  })
  .readonly();
```

## Attack Scenario

1. Attacker sends PUT /systems/:id with encryptedData containing 200KB of junk
2. Request passes body limit (256KB total), Zod parses it, service processes it
3. Wastes CPU, memory, and storage

## Fix

1. Determine the actual max size for encrypted system metadata from the crypto layer
2. Add a constant to `packages/validation/src/validation.constants.ts` with JSDoc
3. Apply `.max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE)` to the schema

```typescript
encryptedData: z.string().min(1).max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE),
```

## Checklist

- [ ] Determine appropriate max size from crypto layer (base64 overhead of max payload)
- [ ] Add constant to validation.constants.ts with JSDoc
- [ ] Update UpdateSystemBodySchema with .max() constraint
- [ ] Add test: verify oversized encryptedData is rejected with 400
- [ ] Check if other schemas have similar unbounded string fields

## References

- CWE-400: Uncontrolled Resource Consumption
