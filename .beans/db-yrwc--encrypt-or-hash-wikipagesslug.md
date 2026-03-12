---
# db-yrwc
title: Encrypt or hash wikiPages.slug
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T08:46:01Z
parent: db-2nr7
---

Slugs may be descriptive (e.g. trauma-history) — reveals content structure without decryption. Ref: audit M14

## Summary of Changes

Replaced plaintext `slug VARCHAR(255)` with `slugHash VARCHAR(64)` (BLAKE2B-256 keyed hash, hex-encoded) in wiki_pages schema for both PG and SQLite. The plaintext slug is already stored in `encryptedData` per the encryption tier map.

**Schema changes:**

- `packages/db/src/schema/pg/journal.ts` — `slug` → `slugHash` (varchar 64)
- `packages/db/src/schema/sqlite/journal.ts` — `slug` → `slugHash` (text)
- Unique index renamed: `wiki_pages_system_id_slug_idx` → `wiki_pages_system_id_slug_hash_idx`

**Test helpers:** Updated DDL in both `pg-helpers.ts` and `sqlite-helpers.ts`

**Integration tests:** Updated all slug references to slugHash with 64-char hex strings in both PG and SQLite journal tests

**Types:** Added `slugHash: string` to `ServerWikiPage` in `encryption.ts`, updated tier map
