---
# ps-6phh
title: Plaintext/special entity type SoT consolidation
status: draft
type: epic
priority: normal
created_at: 2026-04-25T08:02:48Z
updated_at: 2026-04-25T08:02:52Z
parent: ps-cd6x
blocked_by:
  - ps-y4tb
---

Consolidate the type chain for plaintext and special entities — sibling to ps-y4tb (which covers encrypted entities). Tackled after the encrypted-entity work proves the pattern.

## Scope: PLAINTEXT/SPECIAL ENTITIES (23 entities)

Per the 2026-04-25 audit:

- Plaintext with standard ServerMetadata (19 entities): account, account-purge-request, audit-log-entry, auth-key, blob, bucket-key-rotation, bucket-rotation-item, device-token, device-transfer-request, export-request, field-definition-scope, friend-code, friend-notification-preference, import-job, key-grant, notification-config, recovery-key, sync-document, webhook-config
- Plaintext junction tables with EncryptedFields = never (3 entities): structure-entity-association, structure-entity-link, structure-entity-member-link
- Request-only batch operation type (1 entity): import-entity-ref

## Differences from the encrypted bean

- No XEncryptedFields keys-union to lift (some have it set to never)
- No data-package transform (no encryption to apply)
- No XEncryptedInput type
- No XResult / EncryptedWire wrapping (XServerMetadata IS the wire shape)
- Some entities have hand-rolled request input types in @pluralscape/types (LoginCredentials, RegistrationInitiateInput, etc.) that need case-by-case judgment about whether to keep, redefine via z.infer, or drop

## Goals

- Drop redundant \*Body interfaces in @pluralscape/types where they duplicate z.infer<XBodySchema>
- Drop hand-rolled XRaw types in packages/data where applicable (some plaintext entities don't have transforms)
- Service signature cleanup: drop params: unknown, accept z.infer<XBodySchema>
- Add Zod-to-types parity tests for any hand-rolled request input types
- Audit and document handling for request-only types (import-entity-ref) and aggregated/computed result types

## Spec

To be written after ps-y4tb (encrypted entities) lands and the consolidation pattern is proven.
