---
# ps-xfai
title: Fix SP import mapper payloads to match domain encrypted field types
status: completed
type: bug
priority: normal
created_at: 2026-04-12T07:16:20Z
updated_at: 2026-04-12T08:40:18Z
---

Import mappers produce ad-hoc payload shapes that don't match the domain EncryptedFields types from @pluralscape/data. This causes decryptMember/decryptNote/etc to throw at runtime when the mobile app tries to read imported data. Each mapper must type its encrypted payload against the corresponding domain type and provide sensible defaults for missing fields.

## Summary of Changes

Derived each `Mapped*` type from two existing contracts: `Create*BodySchema` (validation) and `*EncryptedFields` (data transforms). Every mapper now produces `{ encrypted: EncryptedFields, ...plaintextApiFields }` instead of ad-hoc flat shapes.

### Core changes

- Added `BucketEncryptedFields` to `@pluralscape/data` (was missing)
- Rewrote all 12 mapper types using `Omit<z.infer<typeof CreateSchema>, "encryptedData"> & { encrypted: EncryptedFields }`
- Fixed field mappings: `pronouns` → array, `avatarUrl` → `avatarSource` (ImageSource), added `saturationLevel`, `tags`, `emoji`, `backgroundColor`, etc.
- Removed deprecated wrapper types: `MappedMemberCore`, `MappedMemberOutput`, `MappedPollCore`, `MappedPollOutput`, `MappedJournalParagraphBlock`

### Downstream updates

- E2E persister: encrypts `entity.payload.encrypted` and passes plaintext fields separately
- Mobile persisters (13 files): updated local `*Payload` interfaces, type guards, and encrypt calls
- Mobile trpc-persister-api bridge: passes new plaintext fields to tRPC mutations
- `PersisterProc*` types: updated to include new fields (required, sortOrder, memberId, etc.)
- Import engine: updated legacy bucket synthesis to use new encrypted shape
- All mapper unit tests (11 files), integration tests, engine tests, mobile persister tests, and trpc-persister-api tests updated

### Verification

- Full monorepo typecheck: 17/17 packages pass
- Full monorepo lint: 14/14 packages pass
- Unit tests: 11,579 passed (833 test files)
