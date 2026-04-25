---
# ps-f3ox
title: 'Class E server-side T3 encryption: webhook-delivery'
status: draft
type: task
priority: normal
created_at: 2026-04-25T08:07:36Z
updated_at: 2026-04-25T08:07:49Z
parent: ps-cd6x
blocked_by:
    - ps-y4tb
---

webhook-delivery is the lone encrypted entity using server-side T3 encryption (Uint8Array signed with server-held key) instead of E2E EncryptedBlob.

## Why it doesn't fit the canonical chain

- WebhookDeliveryServerMetadata.encryptedData is Uint8Array (not EncryptedBlob)
- Encryption is server-side only — not E2E from the client
- No client-side decryption transform exists in packages/data
- EncryptedWire<T> assumes EncryptedBlob; doesn't apply here
- The wire shape (what crosses HTTP) for webhook-delivery is server-internal — clients don't normally see deliveries; they're admin/audit views

## Question for design

Does webhook-delivery benefit from the canonical chain at all, or is it appropriate to leave it as a documented exception?

Options:
- (a) Define a sibling chain for T3 server-encrypted entities: XServerMetadata + XResult + XWire, where Result/Wire convert Uint8Array to base64 string
- (b) Leave webhook-delivery alone; document why it's an exception in ADR-023
- (c) Standardize the parts that do apply (Drizzle parity, Wire shape) but keep the encryption layer bespoke

## Acceptance

- A design call resolves the option above
- ADR-023 includes a section on T3 server-side encrypted entities (whether webhook-delivery is the only one or not)
- If (a) is chosen: parity tests + types-package additions match
- If (b) is chosen: a comment in webhook-delivery.ts explains why it diverges

## Blocked-by

ps-y4tb (so the canonical chain is settled before we decide how webhook-delivery relates to it).
