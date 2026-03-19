---
# crypto-og5h
title: Multi-device key transfer
status: todo
type: epic
priority: high
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-19T11:40:27Z
parent: ps-afy4
blocked_by:
  - crypto-qiwh
  - api-fh4u
---

Server relay, WebSocket handshake, QR code UI, and rate limiting for multi-device key transfer. Crypto primitives are in crypto-qiwh.

## Scope

Server-side endpoints and jobs for the multi-device key transfer protocol: initiate transfer (generate 8-digit code), complete transfer (verify code, write encrypted key material), WebSocket push for transfer approval, cleanup of expired sessions, and per-account rate limiting.

Blocked by api-fh4u (WebSocket server) — uses WebSocket push for transfer approval notifications.

## Acceptance Criteria

- Initiate endpoint creates transfer request with Argon2id-derived key (code never stored plaintext), 5-minute expiry
- Complete endpoint verifies code, writes encryptedKeyMaterial; wrong code → 403, expired → 410, double-complete → 409
- WebSocket push notifies source device on transfer approval within 1s
- Cleanup job expires pending transfers past expiresAt
- Per-account rate limit (e.g., 3/hour); 4th attempt → 429
- E2E tests cover full flow, expired code rejection, and rate limiting

## Design References

- `docs/planning/encryption-research.md` — Encryption protocol design
- `docs/adr/006-encryption.md` — Encryption architecture decision
- `packages/crypto/` — Crypto primitives (crypto-qiwh)
