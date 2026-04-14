# @pluralscape/import-pk

PluralKit import engine — maps PluralKit JSON exports to Pluralscape entities.

Parses PluralKit's export format, maps members, groups, group membership, and
fronting sessions (switches) to Pluralscape entities, and drives a resumable
import via the shared `Persister` interface from `@pluralscape/import-core`.

This package is **mobile-compatible** — no Node streams, no `fs`, no React.

---

## Collections mapped

| PK Export Field    | Pluralscape Entity | Notes                                      |
| ------------------ | ------------------ | ------------------------------------------ |
| `members`          | member             | Name, pronouns, description, color, avatar |
| `groups`           | group              | Name, description, color                   |
| `members[].groups` | group-membership   | Derived from member-to-group references    |
| `switches`         | fronting-session   | Zero-duration sessions bumped by 1ms       |

### Zero-duration session handling

PluralKit allows switches with identical start and end timestamps (zero-duration).
Pluralscape requires `endTime > startTime`, so the mapper bumps `endTime` by 1ms
for any zero-duration session.

---

## E2E test setup

PK import E2E tests run against a real PluralKit API instance with seeded test data.

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
- `packages/import-core` — shared orchestration engine
- `packages/import-sp` — Simply Plural import (sibling engine)
- `scripts/pk-seed` — PK test data seeder
