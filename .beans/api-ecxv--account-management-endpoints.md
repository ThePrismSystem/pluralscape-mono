---
# api-ecxv
title: Account management endpoints
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:33:04Z
updated_at: 2026-03-17T06:48:39Z
parent: api-o89k
blocked_by:
  - api-1v5r
---

- [x] GET /account — returns account info (accountId, accountType, systemId, createdAt, updatedAt)
- [x] PUT /account/email — change email with password verification, optimistic locking, anti-enumeration
- [x] PUT /account/password — change password, re-derive KEK, re-wrap master key, revoke other sessions
- [x] Zod schemas: ChangeEmailSchema, ChangePasswordSchema
- [x] Audit event type: auth.email-changed
- [x] Shared helpers: serializeEncryptedPayload, deserializeEncryptedPayload, fromHex
- [x] DB migration for audit event CHECK constraint
- [x] Unit tests for service layer and route handlers

## Summary of Changes

Implemented three account management endpoints mounted at /account:

- GET /account — returns current account info (no email, zero-knowledge)
- PUT /account/email — validates password, hashes new email, optimistic lock, audit log, anti-enumeration on duplicate
- PUT /account/password — validates password, unwraps/re-wraps master key with new KEK, revokes other sessions, audit log, memzero cleanup

Extracted serializeEncryptedPayload to shared lib, added deserializeEncryptedPayload and fromHex. Added ChangeEmailSchema/ChangePasswordSchema validation. Added auth.email-changed audit event type with DB migration.
