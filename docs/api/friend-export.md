# Friend Data Export API

Paginated endpoints for exporting bucket-visible encrypted data from a friend's system. Designed for client-side search: the client pulls all permitted data locally, builds an FTS5 index, and searches without server involvement (zero-knowledge).

## Endpoints

### GET /v1/account/friends/:connectionId/export/manifest

Returns per-entity-type counts and freshness timestamps so the client can determine which entity types need refreshing before starting paginated downloads.

**Query parameters:** None

**Response (200):**

```json
{
  "data": {
    "systemId": "sys_...",
    "entries": [
      { "entityType": "member", "count": 5, "lastUpdatedAt": 1711612800000 },
      { "entityType": "group", "count": 0, "lastUpdatedAt": null }
    ],
    "keyGrants": [
      { "id": "kg_...", "bucketId": "bkt_...", "encryptedKey": "...", "keyVersion": 1 }
    ],
    "etag": "W/\"a1b2c3d4e5f67890\""
  }
}
```

**Headers:**

- `ETag` — weak ETag for conditional requests

**Conditional requests:**

- Send `If-None-Match: <etag>` to receive 304 Not Modified when data hasn't changed

### GET /v1/account/friends/:connectionId/export

Returns a cursor-paginated page of bucket-visible encrypted entities for a single entity type.

**Query parameters:**

| Parameter  | Type   | Required | Default | Description                                  |
| ---------- | ------ | -------- | ------- | -------------------------------------------- |
| entityType | string | yes      | —       | One of the 21 BucketContentEntityType values |
| limit      | number | no       | 50      | Page size (1-100)                            |
| cursor     | string | no       | —       | Cursor from a previous page's `nextCursor`   |

**Response (200):**

```json
{
  "data": [
    {
      "id": "mem_...",
      "entityType": "member",
      "encryptedData": "base64...",
      "updatedAt": 1711612800000
    }
  ],
  "nextCursor": "eyJpZCI6...",
  "hasMore": true,
  "totalCount": null,
  "etag": "W/\"a1b2c3d4e5f67890\""
}
```

**Headers:**

- `ETag` — weak ETag for conditional requests

**Error responses:**

- 400 — missing or invalid `entityType`, invalid `cursor`
- 404 — connection not found, not accepted, archived, or cross-account

## Entity types

All 21 `BucketContentEntityType` values are exportable:

member, group, channel, message, note, poll, relationship, structure-entity-type, structure-entity, journal-entry, wiki-page, custom-front, fronting-session, board-message, acknowledgement, innerworld-entity, innerworld-region, field-definition, field-value, member-photo, fronting-comment

## Design notes

- **Bucket filtering**: Only entities tagged with buckets assigned to the friend connection are returned (fail-closed: untagged entities are invisible)
- **Post-fetch filtering**: Pages may contain fewer items than `limit` because bucket filtering happens after the database query
- **Ordering**: Entities are ordered by `updatedAt ASC, id ASC` for natural incremental sync
- **Cursor**: Composite cursor encoding (updatedAt, id) for deterministic keyset pagination
- **Rate limiting**: Both endpoints use the `readDefault` rate limit category
- **Authentication**: Requires a valid session token (Bearer auth)
