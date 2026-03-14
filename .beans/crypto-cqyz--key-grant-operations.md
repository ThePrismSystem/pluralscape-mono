---
# crypto-cqyz
title: Key grant operations
status: in-progress
type: task
priority: high
created_at: 2026-03-08T13:34:05Z
updated_at: 2026-03-14T10:32:04Z
parent: crypto-gd8f
blocked_by:
  - crypto-l3hj
  - crypto-mp96
---

Asymmetric key grant creation and decryption for Privacy Bucket sharing

## Scope

- `createKeyGrant(bucketKey: BucketKey, friendPublicKey: X25519PublicKey): KeyGrantBlob`
- `decryptKeyGrant(grant: KeyGrantBlob, privateKey: X25519PrivateKey): BucketKey`
- Uses crypto_box (X25519 + XSalsa20-Poly1305) for authenticated encryption
- Grant metadata: bucket_id, key_version included in AAD
- Batch operations: `createKeyGrants(bucketKey, friendPublicKeys[]): KeyGrantBlob[]`
- Revocation: on friend removal, old grants deleted, new grants created with rotated key for remaining friends

## Acceptance Criteria

- [ ] createKeyGrant encrypts bucket key with friend's public key
- [ ] decryptKeyGrant recovers bucket key with private key
- [ ] Authenticated encryption (tamper detection)
- [ ] Bucket ID and version bound via AAD
- [ ] Batch grant creation for efficiency
- [ ] Unit test: create → decrypt roundtrip
- [ ] Unit test: wrong private key fails decryption
- [ ] Unit test: batch creation for multiple friends

## References

- ADR 006 (Privacy Bucket Model)
- encryption-research.md section 4.1
