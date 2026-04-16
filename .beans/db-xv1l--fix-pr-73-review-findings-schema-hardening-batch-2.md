---
# db-xv1l
title: "Fix PR #73 review findings: schema hardening batch 2"
status: completed
type: task
priority: normal
created_at: 2026-03-12T09:15:30Z
updated_at: 2026-04-16T07:29:39Z
parent: db-2nr7
---

Address all review findings from PR #73 multi-agent review: slug_hash CHECK, branded SlugHash type, JSDoc fixes, mutual-exclusion CHECK on api_keys, nullable-name view tests, bean formatting, test cleanup, TTL constants, tier map corrections

## Summary of Changes

- Generated Drizzle migrations (pg/0004, sqlite/0005) for batch 2 schema changes
- Added `CHECK (length(slug_hash) = 64)` to wiki_pages in both PG and SQLite schemas + DDL helpers
- Added branded `SlugHash` type to `@pluralscape/types` and updated `ServerWikiPage.slugHash`
- Updated `ServerWikiPage` JSDoc to remove algorithm specificity (TBD)
- Moved webhook_deliveries JSDoc from above webhookConfigs to above webhookDeliveries (PG)
- Added `CHECK (name IS NOT NULL OR encrypted_data IS NOT NULL)` to api_keys in both schemas + DDL helpers
- Added slug_hash length CHECK tests (PG + SQLite journal tests)
- Added mutual-exclusion CHECK tests (PG + SQLite api-keys tests)
- Added nullable-name api_key view tests (PG + SQLite views tests)
- Updated "allows nullable name" tests to provide encryptedData (satisfying new CHECK)
- Fixed literal `\n` in 6 bean summaries
- Normalized slugHash test fixture style to `"a".repeat(64)`
- Extracted TTL retention constants (MS_PER_DAY, TTL_RETENTION_DAYS) to test helpers
- Updated webhook tests to use shared TTL constants
- Added "(pending migration)" qualifiers to Session/ApiKey tier map entries
- Updated ServerAuditLogEntry JSDoc ("will handle" future tense)
- Updated WebhookDelivery tier map to match actual schema field names
- Updated encryption type test for branded SlugHash
