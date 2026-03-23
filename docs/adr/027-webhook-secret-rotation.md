# ADR 027: Webhook Secret Rotation

## Status

Accepted

## Context

Webhook signing secrets (HMAC keys) are stored as T3 binary columns in the `webhook_configs` table (see [ADR 025](025-webhook-secret-storage.md)). These secrets need to be rotated periodically or after a suspected compromise.

This ADR documents the operational procedure for webhook secret rotation and the API surface that supports it.

## Decision

### Rotation Procedure

1. **Generate a new secret**: The system owner calls `PUT /systems/:systemId/webhook-configs/:webhookId` with the desired updates, or a dedicated rotation endpoint generates a new random HMAC key. In the current implementation, secret rotation is performed by creating a new webhook config and archiving the old one, since the secret is only returned at creation time (matching the GitHub webhook model).

2. **Alternative: In-place rotation** (future enhancement): A `POST /systems/:systemId/webhook-configs/:webhookId/rotate-secret` endpoint would:
   - Generate a new random 256-bit HMAC signing key
   - Overwrite the existing `secret` column in `webhook_configs`
   - Return the new secret in the response body (one-time exposure)
   - The old secret is immediately invalidated

3. **Update the consumer**: The webhook consumer must update their signature verification to use the new secret. During the transition window, consumers may need to verify against both old and new secrets.

4. **Pending deliveries**: Any pending deliveries created before rotation were signed (or will be signed at delivery time) using the secret that was active when the delivery is processed. Since signatures are computed at delivery time (not at dispatch time), rotating the secret immediately affects all future deliveries, including retries of previously failed ones.

### Operational Guidelines

- **Rotation frequency**: Rotate webhook secrets at minimum every 90 days, or immediately after any suspected compromise.

- **Transition period**: When rotating secrets, the webhook consumer should be updated first to accept the new secret. If the consumer cannot be updated atomically, it should temporarily accept signatures from both the old and new secrets during the transition.

- **Monitoring**: After rotation, monitor webhook delivery success rates. A spike in failures may indicate the consumer was not updated to use the new secret.

- **Audit trail**: All webhook config mutations (including secret rotation) are logged in the audit log with event type `webhook-config.updated`.

- **Self-hosted deployments**: Self-hosted users should enable SQLCipher or volume-level encryption to protect webhook secrets at rest. Rotation does not change the storage tier (secrets remain T3).

### API Surface

| Operation                  | Endpoint                                        | Notes                |
| -------------------------- | ----------------------------------------------- | -------------------- |
| Create config (new secret) | `POST /systems/:id/webhook-configs`             | Returns secret once  |
| Archive old config         | `POST /systems/:id/webhook-configs/:id/archive` | Disables old webhook |
| List configs               | `GET /systems/:id/webhook-configs`              | Secret never exposed |
| Get config                 | `GET /systems/:id/webhook-configs/:id`          | Secret never exposed |

## Consequences

**Positive:**

- Clear operational procedure for secret rotation
- Audit trail for all secret changes
- Compatible with zero-downtime rotation via create-then-archive pattern

**Negative:**

- Current implementation requires creating a new config (new ID) rather than in-place rotation
- Pending deliveries for the old config may fail if the old config is archived before they complete
- Consumer must handle the new webhook config ID if using the create-then-archive pattern

## References

- [ADR 025: Webhook Secret Plaintext Storage](025-webhook-secret-storage.md)
- `packages/db/src/schema/pg/webhooks.ts` (schema definition)
- `apps/api/src/services/webhook-config.service.ts` (CRUD implementation)
