# @pluralscape/import-pk

PluralKit import engine — maps PluralKit data to Pluralscape entities.

Accepts two source modes — a PluralKit JSON export file or the live PK REST API
(via `pkapi.js`) — and maps members, groups (with their member rosters),
fronting sessions (derived from switches), and a synthesised privacy bucket to
Pluralscape entities. Mapped payloads are typed against the
`@pluralscape/validation` request schemas. The package drives a resumable,
checkpoint-based import via the shared `Persister` interface from
`@pluralscape/import-core`.

---

## Public surface

```ts
import {
  runPkImport,
  createPkFileImportSource,
  createPkApiImportSource,
  PK_DEPENDENCY_ORDER,
  PK_MAPPER_DISPATCH,
  pkCollectionToEntityType,
} from "@pluralscape/import-pk";
```

### `runPkImport(args): Promise<ImportRunResult>`

Thin wrapper around `runImportEngine` from `@pluralscape/import-core`. Walks
`PK_DEPENDENCY_ORDER`, dispatches each document through `PK_MAPPER_DISPATCH`,
persists via the injected `Persister`, and calls `onProgress` at every
checkpoint boundary.

### Source factories

| Factory                    | Use case                                    |
| -------------------------- | ------------------------------------------- |
| `createPkFileImportSource` | PK JSON export file (Node `fs`, whole-file) |
| `createPkApiImportSource`  | Live PK REST API via `pkapi.js`             |

Both factories return an `ImportDataSource`. The API source wraps `pkapi.js`
and converts its class-based Member / Group / Switch shapes into plain objects
matching the export schema, so a single set of mappers covers both modes.

The file source uses `node:fs` and validates the whole export against
`PKPayloadSchema` (Zod) on first read. To keep the size check and the read on
the same file object — and avoid path-based TOCTOU (e.g. symlink swap) — it
opens a single file descriptor and pairs `fstatSync` with `readFileSync(fd)`.
The size cap is `MAX_IMPORT_FILE_BYTES` from `@pluralscape/import-core`. Mobile
callers should use the API source; the file source is Node-only.

The API source does not re-run `PKPayloadSchema` over pkapi.js objects — the
SDK's typed shapes act as the schema. Only the per-member `privacy` blob is
re-parsed defensively (with a small ad-hoc Zod record schema) before being
forwarded to the privacy-bucket synthesis pass.

### API source guards

The API source enforces two boundary checks before any request reaches the
wire:

- **Token sanity** — empty or whitespace-only tokens are rejected before they
  can be sent as a blank `Authorization` header.
- **HTTPS-or-loopback** — when `baseUrl` is supplied, `http://` is refused
  except for loopback hosts (`localhost`, `127.0.0.1`, `::1`). IPv6 literal
  brackets are stripped before the host check so `http://[::1]:…` is
  recognised as loopback. When `baseUrl` is omitted, `pkapi.js` uses its
  built-in `https://api.pluralkit.me` default.

---

## Collections mapped

| PK Source      | Pluralscape Entity | Notes                                                                                  |
| -------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `members`      | member             | name, description, pronouns (singleton list), color (singleton list), external avatar  |
| `groups`       | group              | name, description, color, external icon as `imageSource`, member roster on the payload |
| `switches`     | fronting-session   | Diffed into per-member sessions; see below                                             |
| synthetic scan | privacy-bucket     | One "PK Private" bucket synthesised from PK per-member privacy flags                   |

Group → member memberships ride along inside the group payload's `memberIds`
field — there is no separate `group-membership` collection. Unresolved member
refs are warned-and-skipped rather than failing the group.

`PK_DEPENDENCY_ORDER` (and the underlying `PK_COLLECTION_NAMES`) is
`member → group → switch → privacy-bucket`. The privacy-bucket synthesis pass
walks collected member privacy data and exposes the set of "private" member
IDs as cross-pass metadata on the `MappingContext`, which the member mapper
reads via `ctx.getMetadata("privacy-bucket", "synthetic:pk-private", "memberIds")`
to attach the synthetic bucket.

### Switch-to-session diff

PK records snapshots of who is fronting at a timestamp. The switch mapper
sorts switches, tracks active fronters, and emits a completed session for each
member when they drop out of the current snapshot. Members still fronting at
the end of the stream become open sessions (`endTime = null`).

### Zero-duration session handling

PluralKit allows consecutive switches with identical timestamps
(zero-duration). Pluralscape requires `endTime > startTime`, so the mapper
bumps `endTime` by 1 ms whenever `endTime === startTime`. Without this every
such session would be rejected by the API's ordering constraint.

### Privacy bucket synthesis

PK has per-field privacy flags on members; Pluralscape has tagged privacy
buckets. The `privacy-bucket` batch mapper scans collected member privacy data
and synthesises a single "PK Private" bucket when any member has at least one
private field. Both source modes feed it: the file source reads
`payload.members[].privacy`, and the API source collects privacy data during
member iteration and yields a synthetic `privacy-scan` document for the
`privacy-bucket` pass.

---

## Error classification

`classifyPkError` wraps `pkapi.js`'s `APIError` with HTTP-status-aware
classification before falling back to `classifyErrorDefault`:

| Status          | Fatal | Recoverable | Meaning                             |
| --------------- | ----- | ----------- | ----------------------------------- |
| 401 / 403       | Yes   | No          | Auth failure; retry cannot succeed  |
| 404             | No    | —           | May resolve as prerequisites finish |
| 429             | No    | —           | Rate-limit; retry with backoff      |
| 5xx             | No    | —           | Transient server-side failure       |
| Other / missing | Yes   | Yes         | Surfaced without retry-looping      |

`APIError.status` is typed as `string` by `pkapi.js` but arrives at runtime as
a number, a stringified number, or the literal `"???"`. The classifier
normalises it to `number | undefined` up-front so every branch compares a
single shape.

---

## E2E test setup

PK import E2E tests run against a real PluralKit API instance with seeded test
data.

### Prerequisites

1. Copy the environment template:

   ```bash
   cp .env.pk-test.example .env.pk-test
   ```

2. Fill in the PK API credentials in `.env.pk-test`

3. Seed test data (creates deterministic PK entities and writes a manifest):
   ```bash
   source .env.pk-test && npx tsx scripts/pk-seed/seed.ts
   ```

### Running E2E tests

```bash
source .env.pk-test && pnpm vitest run --project import-pk-e2e
```

The seed script produces a manifest file that E2E tests use to verify imported
entities match the seeded data. Tests are parameterized — each entity type is
verified against its manifest entry.

---

## Dependencies

- `@pluralscape/import-core` — Persister interface, checkpoint, error classification
- `@pluralscape/types` — domain types, branded IDs
- `@pluralscape/validation` — Zod schemas
- `@pluralscape/data` — data transforms
- `pkapi.js` — PluralKit API v2 client

---

## See also

- [ADR 033](../../docs/adr/033-pluralkit-api-client-library.md) — PK API client library selection
- [ADR 034](../../docs/adr/034-import-core-extraction.md) — import-core extraction rationale
- `packages/import-core` — shared orchestration engine
- `packages/import-sp` — Simply Plural import (sibling engine)
- `scripts/pk-seed` — PK test data seeder
