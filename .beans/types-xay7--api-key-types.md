---
# types-xay7
title: API key types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:32Z
updated_at: 2026-03-08T14:22:10Z
parent: types-im7i
blocked_by:
  - types-av6x
---

API key types for hybrid metadata and crypto key model per ADR 013.

## Scope

- `ApiKey`: id (ApiKeyId), accountId, name, keyType (ApiKeyType), scopes (ApiKeyScope[]), createdAt, lastUsedAt, revokedAt (nullable)
- `ApiKeyType`: 'metadata' | 'crypto'
  - Metadata keys: access T3 plaintext data only. No crypto needed. For simple integrations.
  - Crypto keys: carry encrypted key material, enabling T1/T2 decryption. Created from authenticated client session.
- `ApiKeyScope`: 'fronting:read' | 'fronting:write' | 'members:read' | 'members:write' | 'chat:read' | 'chat:write' | 'buckets:read' | 'buckets:write' | 'webhooks:manage' | 'notes:read' | 'notes:write' | 'journal:read' | 'journal:write' | 'system-structure:read' | 'friends:read' | 'friends:write' | 'system:read' | 'system:write' | 'groups:read' | 'groups:write' | 'search:read' | 'import:write' | 'export:read' | 'full'
- `ApiKeyToken`: the bearer token string (shown once at creation, hashed for storage)
- `ApiKeyWithSecret`: creation response type including the plaintext token
- Crypto keys include: encryptedKeyMaterial (Uint8Array)

## Acceptance Criteria

- [ ] ApiKey type with metadata and crypto key variants
- [ ] ApiKeyScope covers all 17+ API endpoint categories
- [ ] Token shown once at creation (ApiKeyWithSecret)
- [ ] Crypto key carries encrypted key material
- [ ] Revocation support via revokedAt
- [ ] Unit tests for scope validation and key type discrimination

## References

- features.md section 9 (Public REST API, hybrid auth model)
- ADR 013 (API Authentication with E2E Encryption)
