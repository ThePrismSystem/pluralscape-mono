---
# crypto-cpir
title: "Audit remediation: packages/crypto (2026-04-20)"
status: completed
type: epic
priority: high
created_at: 2026-04-20T09:20:30Z
updated_at: 2026-04-20T12:11:02Z
parent: ps-h2gl
---

Remediation from comprehensive audit 2026-04-20. 2 High findings (QR transfer MITM window, Argon2id params). See docs/local-audits/comprehensive-audit-2026-04-20/crypto.md. Tracking: ps-g937.

## Summary of Changes

All 4 high-priority M9 audit findings landed as individual commits on chore/audit-m9-crypto:

- crypto-5d49 (fix): QR transfer payload no longer embeds the 10-digit code; code is manual-entry on the target device. Closes MITM/photography window.
- crypto-z2eg (fix, ADR 037): Split Argon2id parameters into TRANSFER (t=3, m=32 MiB) and MASTER_KEY (t=4, m=64 MiB) context-specific profiles. Removed unused 1 GiB SENSITIVE constants.
- crypto-1mvo (perf): encryptStreamAsync / encryptBlobStream accept Uint8Array | ReadableByteStream | AsyncIterable<Uint8Array>.
- crypto-tirn (perf): decryptStream pre-allocates output Uint8Array from payload.totalLength; no second-pass concat.
