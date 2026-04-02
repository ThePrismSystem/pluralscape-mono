# tRPC Parity Remediation Design

**Date:** 2026-04-02
**Purpose:** Close all 56 gaps identified in the tRPC parity audit so every REST endpoint has a matching tRPC procedure
**Source:** `docs/local-audits/trpc-parity-audit.md`, beans api-l2qt, api-yvaw, api-w4rd, api-x7uh, api-gey8, api-s5s1, api-azpi, api-icgc

## Context

The tRPC parity audit found 259 existing tRPC procedures covering ~85% of ~306 REST endpoints. This spec covers closing the remaining 54 P0 gaps + 2 P1 gaps across 5 categories. Every service function and REST route already exists — this is purely tRPC wiring.

## Scope

### Category 1: New Routers (31 procedures)

Four new router files in `apps/api/src/trpc/routers/`, each added to `root.ts`:

**`friendRouter`** (15 procedures, `protectedProcedure` — account-level):
- `list` — `listFriendConnections` service, cursor/limit/includeArchived/status filter
- `get` — `getFriendConnection` service, connectionId input
- `accept` — `acceptFriendConnection` service, connectionId input
- `reject` — `rejectFriendConnection` service, connectionId input
- `block` — `blockFriendConnection` service, connectionId input
- `remove` — `removeFriendConnection` service, connectionId input
- `archive` — `archiveFriendConnection` service, connectionId input
- `restore` — `restoreFriendConnection` service, connectionId input
- `updateVisibility` — `updateFriendVisibility` service, connectionId + `UpdateFriendVisibilityBodySchema`
- `getDashboard` — `getFriendDashboard` service, connectionId input
- `getDashboardSync` — dashboard sync service, connectionId input
- `exportData` — `exportFriendData` service, connectionId + entityType/cursor/limit
- `exportManifest` — `getFriendExportManifest` service, connectionId input
- `getNotifications` — get friend notification prefs service, connectionId input
- `updateNotifications` — update friend notification prefs service, connectionId + body

**`friendCodeRouter`** (4 procedures, `protectedProcedure`):
- `generate` — `generateFriendCode` service
- `list` — `listFriendCodes` service
- `redeem` — `redeemFriendCode` service, code input
- `archive` — `archiveFriendCode` service, codeId input

**`webhookConfigRouter`** (9 procedures, `systemProcedure`):
- `list` — `listWebhookConfigs` service, cursor/limit/includeArchived
- `get` — `getWebhookConfig` service, webhookId input
- `create` — `createWebhookConfig` service, body schema
- `update` — `updateWebhookConfig` service, webhookId + body schema
- `delete` — `deleteWebhookConfig` service, webhookId input
- `archive` — `archiveWebhookConfig` service, webhookId input
- `restore` — `restoreWebhookConfig` service, webhookId input
- `rotateSecret` — `rotateWebhookSecret` service, webhookId input
- `test` — `testWebhook` service, webhookId input

**`webhookDeliveryRouter`** (3 procedures, `systemProcedure`):
- `list` — `listWebhookDeliveries` service, cursor/limit/webhookId/status/eventType filters
- `get` — `getWebhookDelivery` service, deliveryId input
- `delete` — `deleteWebhookDelivery` service, deliveryId input

### Category 2: Missing Delete Procedures (9 procedures)

Each follows the same pattern: import delete service function, add `.delete` mutation with `systemProcedure`, branded ID input, audit context.

| Router File | Procedure | Service Function | Input |
|---|---|---|---|
| `snapshot.ts` | `delete` | `deleteSnapshot` | snapshotId |
| `structure.ts` | `deleteType` | delete entity type service | entityTypeId |
| `structure.ts` | `deleteEntity` | delete entity service | entityId |
| `fronting-comment.ts` | `delete` | delete fronting comment service | sessionId + commentId |
| `fronting-report.ts` | `delete` | delete fronting report service | reportId |
| `timer-config.ts` | `delete` | delete timer config service | timerId |
| `message.ts` | `delete` | delete message service | channelId + messageId |
| `innerworld.ts` | `deleteRegion` | delete region service | regionId |
| `innerworld.ts` | `deleteEntity` | delete innerworld entity service | entityId |

### Category 3: Auth Procedures (3 procedures)

**`auth.resetPasswordWithRecoveryKey`** — `errorMapProcedure` (public/unauthenticated):
- Calls `resetPasswordWithRecoveryKey` from `recovery-key.service.ts`
- Input: recovery key + new password (check REST route for schema — may be local or in `@pluralscape/validation`)

**`account.initiateDeviceTransfer`** — `protectedProcedure`:
- Calls `initiateDeviceTransfer` from `device-transfer.service.ts`
- Input: check `routes/account/device-transfer.schema.ts` for the body schema

**`account.completeDeviceTransfer`** — `protectedProcedure`:
- Calls `completeDeviceTransfer` from `device-transfer.service.ts`
- Input: transferId + completion body from `device-transfer.schema.ts`

Note: device transfer schemas may be local to the REST route directory. The implementer should check and either import the existing schema directly or replicate it inline with Zod.

### Category 4: Misc Procedures (11 procedures)

**`account.deleteAccount`** — `protectedProcedure`:
- Calls `deleteAccount` service — GDPR cascading purge

**`boardMessage.pin`** — `systemProcedure`:
- Calls `pinBoardMessage` service, boardMessageId input

**`boardMessage.unpin`** — `systemProcedure`:
- Calls `unpinBoardMessage` service, boardMessageId input

**Bucket rotation (5 procedures, `systemProcedure`):**
- `bucket.initiateRotation` — rotation initiation service, bucketId input
- `bucket.getRotationProgress` — rotation progress service, bucketId + rotationId
- `bucket.claimRotationChunk` — claim service, bucketId + rotationId
- `bucket.completeRotationChunk` — complete service, bucketId + rotationId + chunk data
- `bucket.retryRotation` — retry service, bucketId + rotationId

Follow the REST rotation routes in `routes/buckets/rotations/` for exact service function names and input shapes.

**`structure.getHierarchy`** — `systemProcedure`:
- Calls the hierarchy service used by REST `GET /entities/hierarchy`
- Query: accepts depth cap and optional entity type filters (check REST route)

**`deviceToken.update`** — `systemProcedure`:
- Calls update device token service, tokenId + update body

**`apiKey.get`** — `systemProcedure`:
- Calls get API key service, apiKeyId input

### Category 5: Input Validation Fixes (2 fixes)

**`message.list`** — add to existing input schema:
- `before: z.string().optional()` — messages before this timestamp
- `after: z.string().optional()` — messages after this timestamp
- Forward to service call (service already accepts these params)

**`note.list`** — add to existing input schema:
- `authorEntityType: z.string().optional()`
- `authorEntityId: z.string().optional()`
- `systemWide: z.boolean().optional()`
- Forward to service call (service already accepts these params)

## Implementation Pattern

Every procedure follows the same structure (example from existing `member.delete`):

```typescript
delete: systemProcedure
  .input(z.object({ memberId: brandedIdQueryParam("mem_") }))
  .mutation(async ({ input, ctx }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteMember(ctx.db, ctx.systemId, input.memberId, audit);
    return { success: true as const };
  }),
```

For new routers, follow the full file pattern from `member.ts` or `bucket.ts`:
- Import service functions
- Import schemas from `@pluralscape/validation` (or define inline)
- Import auth procedure (`protectedProcedure` or `systemProcedure`)
- Import `router` from `../trpc.js`
- Export the router
- Add to `root.ts`

## Testing Strategy

**New routers (friend, friendCode, webhookConfig, webhookDelivery):**
- Integration tests verifying: procedures call correct services, return expected shapes, enforce auth guards
- Create `apps/api/src/trpc/routers/__tests__/<router>.integration.test.ts`
- Each procedure: success case + auth guard verification
- Follow existing test patterns in the codebase

**Existing router additions (deletes, pin/unpin, rotation, etc.):**
- Add test cases to existing test files where they exist
- Each new procedure: success case + auth guard enforcement
- Delete procedures: verify 404 on missing entity

**Input validation fixes:**
- Test that new filter fields are accepted and forwarded
- Test filtered results

**E2E:**
- Existing E2E suite exercises the same service paths via REST
- New E2E tests for the 4 new routers (entirely new API surface)

**What we skip:**
- No unit tests for pure wiring (procedure → service) — service functions have their own tests
- No mocking — integration tests hit real I/O per project conventions

## Files Changed

**Created (4 routers + tests):**
- `apps/api/src/trpc/routers/friend.ts`
- `apps/api/src/trpc/routers/friend-code.ts`
- `apps/api/src/trpc/routers/webhook-config.ts`
- `apps/api/src/trpc/routers/webhook-delivery.ts`
- Integration test files for each new router

**Modified (existing routers — add procedures):**
- `apps/api/src/trpc/routers/auth.ts` — add resetPasswordWithRecoveryKey
- `apps/api/src/trpc/routers/account.ts` — add initiateDeviceTransfer, completeDeviceTransfer, deleteAccount
- `apps/api/src/trpc/routers/snapshot.ts` — add delete
- `apps/api/src/trpc/routers/structure.ts` — add deleteType, deleteEntity, getHierarchy
- `apps/api/src/trpc/routers/fronting-comment.ts` — add delete
- `apps/api/src/trpc/routers/fronting-report.ts` — add delete
- `apps/api/src/trpc/routers/timer-config.ts` — add delete
- `apps/api/src/trpc/routers/message.ts` — add delete, fix list input schema
- `apps/api/src/trpc/routers/board-message.ts` — add pin, unpin
- `apps/api/src/trpc/routers/bucket.ts` — add 5 rotation procedures
- `apps/api/src/trpc/routers/innerworld.ts` — add deleteRegion, deleteEntity
- `apps/api/src/trpc/routers/device-token.ts` — add update
- `apps/api/src/trpc/routers/api-key.ts` — add get
- `apps/api/src/trpc/routers/note.ts` — fix list input schema
- `apps/api/src/trpc/root.ts` — add 4 new router imports

## Out of Scope

- REST API changes (already complete)
- Service layer changes (all services already exist)
- New validation schemas in `@pluralscape/validation` (use existing or inline)
- Mobile app consumption (separate milestone)
- Performance optimization
