# ADR 025: Webhook Secret Plaintext Storage (T3 Tier)

## Status

Accepted

## Superseded-by

ADR-027 — the rotation procedure; the in-place overwrite approach described in mitigation #4 of this ADR is replaced by the create-then-archive pattern.

## Context

Pluralscape uses a three-tier encryption model:

- **T1**: End-to-end encrypted (server is zero-knowledge)
- **T2**: Encrypted at rest with server-managed keys
- **T3**: Stored as plaintext in the database (server-readable)

Webhook HMAC signing secrets (`webhook_configs.secret`) are stored as T3 binary columns. The server must read these secrets to compute HMAC signatures on outgoing webhook payloads. This makes E2E encryption (T1) architecturally impossible for this data: the server is the signing party.

This trade-off has been flagged in security audits (CWE-312: Cleartext Storage of Sensitive Information). This ADR formalizes the accepted risk and documents compensating controls.

## Decision

Webhook signing secrets remain at T3 (server-readable binary column) with the following compensating controls:

### Why E2E encryption is not possible

The webhook delivery flow is:

1. An event occurs on the server (e.g., a fronting session starts)
2. The server constructs the webhook payload
3. The server computes `HMAC-SHA256(secret, payload)` and includes the signature in the delivery header
4. The receiving endpoint verifies the signature

Step 3 requires the server to read the secret in plaintext. There is no way to delegate this to the client without fundamentally changing the webhook model (e.g., requiring the client to co-sign payloads, which defeats the purpose of server-to-server webhooks).

### Mitigations

1. **Database encryption at rest**: PostgreSQL deployments use Transparent Data Encryption (TDE) or volume-level encryption. SQLite self-hosted deployments use SQLCipher. This prevents secrets from being read from disk images or backups.

2. **Column-level storage**: Secrets are stored as binary (`pgBinary`/`sqliteBinary`), not as human-readable text. This reduces accidental exposure in logs, query results, or admin interfaces.

3. **Access control**: The `webhook_configs` table is scoped by `system_id` with row-level security. Only the owning system's authenticated sessions can read or modify webhook configurations.

4. **Secret rotation**: Users can regenerate webhook secrets at any time through the API. The old secret is immediately overwritten. Rotation should be recommended in the UI after any suspected compromise.

5. **Signature verification endpoint** (recommended): A future `/webhooks/verify` endpoint would allow consumers to test their signature verification implementation without processing real events. This helps users detect misconfigurations that could lead to accepting unsigned payloads.

## Consequences

**Positive:**

- Standard webhook signature model compatible with all webhook consumers
- Server can deliver signed webhooks without client involvement
- Database encryption at rest provides baseline protection

**Negative:**

- A database breach exposes webhook signing secrets in plaintext
- Server operators (in hosted deployments) can theoretically read webhook secrets
- Self-hosted users who do not enable SQLCipher have no encryption at rest for these secrets

## References

- CWE-312: Cleartext Storage of Sensitive Information
- `packages/db/src/schema/pg/webhooks.ts` (schema definition)
- [ADR 018: Encryption at Rest Boundary](018-encryption-at-rest-boundary.md) (tier definitions)
- [ADR 013: API Auth and Encryption](013-api-auth-encryption.md) (webhook consumer tiers)
