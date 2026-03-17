---
# api-1v5r
title: Registration endpoint
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:52:27Z
updated_at: 2026-03-17T00:02:46Z
parent: api-o89k
---

POST /auth/register: create account (Argon2id hash, emailHash+salt, kdfSalt), create system, generate keypair (encryption + signing authKeys), generate recovery key, create initial session. Support system and viewer account types (ADR 021). Rate limited at authHeavy (5/60s).

## Todo

- [x] S1: Add pwhashStr/pwhashStrVerify to SodiumAdapter interface
- [x] S1: Implement in WasmSodiumAdapter
- [x] S1: Throw UnsupportedOperationError in ReactNativeSodiumAdapter
- [x] S1: Create password.ts (hashPassword, verifyPassword)
- [x] S1: Export from crypto index.ts
- [x] S1: Write password tests (7 passing)
- [x] S2: Create email-hash.ts (hashEmail, getEmailHashPepper)
- [x] S3: Create auth-context.ts (AuthContext, AuthEnv types)
- [x] S4: Create audit-log.ts (writeAuditLog)
- [x] S5: Create auth.constants.ts
- [x] S6: Mount auth routes in api index.ts
- [x] S6: Add @pluralscape/validation dependency
- [x] Create auth.service.ts with registerAccount()
- [x] Create register.ts route handler
- [x] Create routes/auth/index.ts
- [x] Add EMAIL_HASH_PEPPER to .env.example
- [x] Write registration unit tests (mocked DB)

## Summary of Changes

Registration endpoint (POST /auth/register) with full crypto integration: Argon2id password hashing, BLAKE2b email hashing, KEK/DEK master key wrapping, identity keypair generation, recovery key generation, session creation. Anti-enumeration via fake 201 on duplicate email.
