---
# crypto-5d49
title: Move QR transfer code to manual entry (MITM window)
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:22:50Z
updated_at: 2026-04-20T09:22:50Z
parent: crypto-cpir
---

Finding [H1] from audit 2026-04-20. packages/crypto/src/device-transfer.ts:238-244. 10-digit code (~33.2 bits) and Argon2id salt both serialized into QR payload. Anyone photographing/capturing the QR derives the transfer key without additional secret. Fix: move code to manual entry; put only requestId+salt in QR.
