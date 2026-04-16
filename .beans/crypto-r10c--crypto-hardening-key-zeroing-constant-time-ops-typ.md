---
# crypto-r10c
title: "Crypto hardening: key zeroing, constant-time ops, typing"
status: todo
type: task
priority: low
created_at: 2026-04-16T06:58:01Z
updated_at: 2026-04-16T06:58:01Z
parent: ps-0enb
---

Low-severity crypto and rotation-worker findings from comprehensive audit.

## Findings

- [ ] [CRYPTO-S-L1] Non-constant-time comparison for bucket ID/version in grant parsing
- [ ] [CRYPTO-S-L2] Recovery key bytes used directly as AEAD key without KDF
- [ ] [CRYPTO-S-L3] masterKey returned in resetPasswordViaRecoveryKey with no zeroing obligation
- [ ] [CRYPTO-T-L1] assertBoxSecretKey/assertSignSecretKey do not use asserts key is T
- [ ] [CRYPTO-T-L2] getBucketKey takes keyVersion: number, not KeyVersion
- [ ] [CRYPTO-T-L3] No CryptoError base class for instanceof checks
- [ ] [CRYPTO-T-L4] PWHASH_MEMLIMIT_SENSITIVE constant missing
- [ ] [ROTWORKER-S-L1] Plaintext not zeroed after re-encryption
- [ ] [ROTWORKER-S-L2] isHttpError cast unchecked at runtime
- [ ] [CRYPTO-TC-L1] blob-constants.ts values not asserted by any test
- [ ] [ROTWORKER-TC-L1] No test for partial success in processChunk
- [ ] [ROTWORKER-TC-L2] No test for signal.aborted mid-loop path
- [ ] [ROTWORKER-D-L1] All 3 retries exhaust before "failed" with no logging
