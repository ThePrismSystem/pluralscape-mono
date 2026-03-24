# API Limits

This document lists hard caps enforced by the Pluralscape API. All limits return
an appropriate HTTP error when exceeded (typically 409 Conflict or 413 Content Too Large).

## Entity Limits

| Resource                             | Limit     | Error                        | Notes                                                                                   |
| ------------------------------------ | --------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| Custom field definitions per system  | 200       | 409 Conflict                 | Prevents unbounded schema growth. Enforced in `field-definition.service.ts`.            |
| Field values per member              | 200       | Bounded by field definitions | One value per definition; count follows the field definition cap.                       |
| Structure entity/group nesting depth | 50 levels | 409 Conflict                 | Ancestor walk cycle-detection cap. Enforced in `hierarchy.ts` via `MAX_ANCESTOR_DEPTH`. |

## Pagination

| Parameter           | Default | Maximum |
| ------------------- | ------- | ------- |
| Page size (general) | 25      | 100     |
| Page size (members) | 25      | 100     |
| Page size (blobs)   | 25      | 100     |

## Blob Storage

| Resource                   | Limit                     | Error                                    |
| -------------------------- | ------------------------- | ---------------------------------------- |
| Per-blob size (avatar)     | 5 MiB                     | 413 Content Too Large                    |
| Per-blob size (attachment) | 25 MiB                    | 413 Content Too Large                    |
| Per-blob size (export)     | 500 MiB                   | 413 Content Too Large                    |
| System storage quota       | Configured per deployment | 413 Content Too Large (`QUOTA_EXCEEDED`) |
| Presigned upload URL TTL   | 15 minutes                | Upload URL expires silently              |

## Encrypted Data Payloads

| Resource                        | Limit                         |
| ------------------------------- | ----------------------------- |
| Generic encrypted data          | 64 KiB (after base64 decode)  |
| System encrypted data           | 98 KiB (after base64 decode)  |
| Field definition encrypted data | 32 KiB (after base64 decode)  |
| Member encrypted data           | 128 KiB (after base64 decode) |

## Data Retention

| Resource                      | Retention | Notes                                         |
| ----------------------------- | --------- | --------------------------------------------- |
| Webhook deliveries (terminal) | 30 days   | Auto-purged by cleanup job after success/fail |

## Rate Limits

| Category           | Limit   | Window |
| ------------------ | ------- | ------ |
| Global             | 100 req | 60s    |
| Auth (heavy)       | 5 req   | 60s    |
| Auth (light)       | 20 req  | 60s    |
| Device transfer    | 10 req  | 60s    |
| Write operations   | 60 req  | 60s    |
| Read (default)     | 60 req  | 60s    |
| Read (heavy)       | 30 req  | 60s    |
| Blob upload        | 20 req  | 60s    |
| Webhook management | 20 req  | 60s    |
| Data export        | 2 req   | 3600s  |
| Data import        | 2 req   | 3600s  |
| Account purge      | 1 req   | 86400s |
| Audit query        | 30 req  | 60s    |
| Friend code        | 10 req  | 60s    |
| Public API         | 60 req  | 60s    |
| SSE stream         | 5 req   | 60s    |

Rate limits are applied per-category via middleware. See `packages/types/src/api-constants.ts` for authoritative values.
