---
# api-pdy8
title: Encrypted email storage + ADR
status: completed
type: task
priority: critical
created_at: 2026-03-29T02:45:25Z
updated_at: 2026-03-29T07:00:30Z
parent: api-7xw0
---

Server-side encrypted email storage and ADR documenting the decision.

## Scope

- **ADR** documenting server-side encrypted email storage decision (vs. plaintext, vs. E2E). Rationale: server must decrypt to send, but encrypt at rest for defense-in-depth. Analogous to push tokens but with stronger protection.
- Add `encrypted_email` nullable `bytea` column to `accounts` table (PG + SQLite schemas)
- New DB migrations + RLS migration regeneration
- `encryptEmail()` / `decryptEmail()` in `apps/api/src/lib/email-encrypt.ts` using server-held key (`EMAIL_ENCRYPTION_KEY` env var)
- `resolveAccountEmail(accountId): Promise<string | null>` in `apps/api/src/lib/email-resolve.ts`
- Registration stores encrypted email alongside existing hash
- Integration tests: register → resolve email → verify round-trip
- Graceful null return for accounts predating this column

## Checklist

- [ ] Write ADR for server-side encrypted email storage (docs/adr/)
- [ ] Add `encrypted_email` nullable `bytea` column to `accounts` table (PG schema)
- [ ] Add `encrypted_email` column to SQLite schema
- [ ] Regenerate DB migrations + RLS migration
- [ ] Implement `encryptEmail()` / `decryptEmail()` in `apps/api/src/lib/email-encrypt.ts`
- [ ] Implement `resolveAccountEmail(accountId)` in `apps/api/src/lib/email-resolve.ts`
- [ ] Update registration to store encrypted email alongside existing hash
- [ ] Add `EMAIL_ENCRYPTION_KEY` to env schema (`apps/api/src/env.ts`)
- [ ] Integration tests: register → resolve email → verify round-trip
- [ ] Graceful null return for accounts predating this column
- [ ] Unit tests pass, typecheck clean

## Reference Files

- `packages/db/src/schema/pg/auth.ts` — accounts table
- `apps/api/src/lib/email-hash.ts` — existing email hashing

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes\n\nImplemented in PR #310: ADR for server-side encrypted email storage, encrypted_email column on accounts, encryptEmail/decryptEmail utilities, resolveAccountEmail, EMAIL_ENCRYPTION_KEY env var, registration wiring.
