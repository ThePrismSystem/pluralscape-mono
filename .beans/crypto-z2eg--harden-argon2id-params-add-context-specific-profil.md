---
# crypto-z2eg
title: Harden Argon2id params / add context-specific profiles
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:50Z
updated_at: 2026-04-20T11:55:37Z
parent: crypto-cpir
---

Finding [H2] from audit 2026-04-20. packages/crypto/src/crypto.constants.ts:72-75. PWHASH_OPSLIMIT_UNIFIED=4 with 64 MiB memory — meets OWASP threshold but applied to ALL contexts (PIN, transfer key, master key). SENSITIVE constant at 1 GiB exists but unused. Verify mobile memory limits; consider separate profiles for transfer vs master-key derivation.

## Summary of Changes

Split Argon2id parameters into TRANSFER/MASTER_KEY context-specific profiles per ADR 037. Callsites updated per context; the unused 1 GiB SENSITIVE constants were removed.

- Added `Argon2idProfile` type + `ARGON2ID_PROFILE_TRANSFER` (t=3, m=32 MiB) and `ARGON2ID_PROFILE_MASTER_KEY` (t=4, m=64 MiB) in `packages/crypto/src/crypto.constants.ts`.
- Removed unused `PWHASH_*_SENSITIVE` (1 GiB) and obsolete `PWHASH_*_UNIFIED` constants (and their exports from `packages/crypto/src/index.ts` / `SODIUM_CONSTANTS`).
- Re-wired `auth-key.ts` and `pin.ts` to `ARGON2ID_PROFILE_MASTER_KEY`; `device-transfer.ts` to `ARGON2ID_PROFILE_TRANSFER`.
- Added `argon2id-profiles.test.ts` asserting each callsite drives the adapter with the correct profile and that the two profiles produce distinct outputs.
- Updated docstrings and `docs/guides/api-consumer-guide.md` / `packages/crypto/docs/mobile-key-lifecycle.md` to reflect the named profiles.
- Added `docs/adr/037-argon2id-context-profiles.md`.

Pre-release rederivation of existing dev master-key/PIN artifacts is not required (those stay on t=4, m=64 MiB); device-transfer sessions are ephemeral.
