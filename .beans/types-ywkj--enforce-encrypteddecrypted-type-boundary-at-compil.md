---
# types-ywkj
title: Enforce encrypted/decrypted type boundary at compile time
status: completed
type: task
priority: high
created_at: 2026-03-09T12:13:33Z
updated_at: 2026-03-16T07:36:51Z
parent: ps-rdqo
---

When implementing API routes, ensure compile-time enforcement that routes returning ServerMember (with EncryptedBlob fields) cannot accidentally return ClientMember (with decrypted fields). The Encrypted<T>/BucketEncrypted<T>/Plaintext<T> wrappers and Server/Client variants exist in encryption.ts but nothing consumes them yet. Design the middleware/helper that enforces this at the API layer.

Source: Architecture Audit 004, Metric 2

## Summary of Changes

- Added `ServerResponseData` union (26 Server\* types) and `ClientResponseData` union to `packages/types/src/encryption.ts`
- Created `packages/types/src/server-safe.ts` with branded `ServerSafe<T>` type and `serverSafe()` identity function
- Created compile-time tests in `packages/types/src/__tests__/server-safe.test.ts` — validates all 26 Server* types are accepted, all 26 Client* types are rejected, branding semantics, and @ts-expect-error rejections
- Created `apps/api/src/lib/typed-routes.ts` with `safeJson()` Hono helper that requires `ServerSafe`-branded data
- Updated barrel exports in `packages/types/src/index.ts`
