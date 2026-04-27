---
# client-a0gf
title: Wire ApiKey codec transforms when crypto-variant lands client-side
status: todo
type: task
created_at: 2026-04-27T19:00:01Z
updated_at: 2026-04-27T19:00:01Z
parent: ps-cd6x
---

Wire `decryptApiKeyPayload` / `encryptApiKeyPayload` (`packages/data/src/transforms/api-key.ts`) when the ApiKey crypto-variant lands client-side.

## Background

Landed in `types-emid` (PR #579). The codec round-trip is fully tested at the data-layer level. Today no API surface emits or consumes `encryptedData` for ApiKeys — `API_KEY_SELECT_COLUMNS` (`apps/api/src/services/api-key/internal.ts`) deliberately omits `encryptedData`, and `ApiKeyResult` has no encrypted-blob field.

When the crypto-variant work picks up:

- The mobile create flow encrypts `{keyType: "crypto", name, publicKey: Uint8Array}` via `encryptApiKeyPayload` and sends the resulting base64 `encryptedData` to `POST /v1/systems/:id/api-keys`.
- Listing/getting an ApiKey returns `encryptedData`; client calls `decryptApiKeyPayload` to surface the in-memory shape.

## Acceptance

- API endpoints emit/consume `encryptedData` for ApiKey rows on relevant routes.
- Mobile ApiKey create / list / detail views call the codec transforms.
- E2E test exercises the full encrypt-on-create → decrypt-on-display flow with a 32-byte X25519 publicKey.

## Related

- types-emid (PR #579 — schema and transform landed)
- ps-qmyt (Class C extension — original)
- ps-cd6x (Milestone 9a)
