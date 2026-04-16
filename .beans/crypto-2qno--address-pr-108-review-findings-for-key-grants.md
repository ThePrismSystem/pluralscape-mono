---
# crypto-2qno
title: "Address PR #108 review findings for key-grants"
status: completed
type: task
priority: normal
created_at: 2026-03-14T15:59:08Z
updated_at: 2026-04-16T07:29:36Z
parent: crypto-89v7
---

Fix 2 important issues and 9 suggestions from PR #108 review

## Summary of Changes

- Removed redundant MIN_BLOB_LENGTH alias in decryptKeyGrant (#1)
- Fixed spy leak in memzero test with try/finally (#2)
- Extracted sealEnvelope helper to deduplicate boxing logic (#3)
- Added eager recipient key validation in createKeyGrants (#4)
- Replaced manual offset arithmetic with cursor variable in buildEnvelope/parseEnvelope (#5)
- Added EncryptedKeyGrant branded type and updated interfaces (#6)
- Composed params interfaces from KeyGrantBaseParams (#7)
- Added @throws JSDoc to createKeyGrant and createKeyGrants (#8)
- Consolidated wire format documentation into single module-level comment (#9)
- Added max bucket ID boundary test (#10)
- Added Unicode bucket ID roundtrip test (#11)
