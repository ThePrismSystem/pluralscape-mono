# ADR 037: Argon2id Context-Specific Profiles

## Status

Accepted

## Context

Every Argon2id key derivation in Pluralscape currently runs against a single
`PWHASH_*_UNIFIED` parameter set (`opslimit = 4`, `memlimit = 64 MiB`). That
unified profile is applied by:

1. **Master-key / auth-key derivation** (`packages/crypto/src/auth-key.ts`) —
   derives the authKey + passwordKey from the user's password at login,
   registration, and password reset. Runs once per auth flow on a device that is
   typically the user's laptop or phone with ample memory.
2. **PIN hashing** (`packages/crypto/src/pin.ts`) — stores a self-contained
   Argon2id hash of the local-unlock PIN. Verified on every PIN entry on mobile,
   where thermal / memory pressure matters.
3. **Device-transfer key derivation** (`packages/crypto/src/device-transfer.ts`)
   — stretches a 10-digit code (~33.2 bits of entropy) into a one-shot
   symmetric key used for a 5-minute transfer session. Runs on both the source
   and target device of a transfer.

One knob for three workloads leaves real security and UX on the table:

- The transfer code is the weakest input (~33.2 bits), but it only needs to
  resist a 5-minute online attack plus a modest offline window. Matching it to
  the same `t = 4, m = 64 MiB` profile as a long-lived master key derivation
  spends latency budget on a short-lived secret.
- The master-key derivation protects the _entire account_ for the lifetime of
  the password. It is the single highest-value Argon2id use in the product and
  deserves the full OWASP ASVS 4.x sensitive-tier budget, not the minimum.
- The previous "SENSITIVE" constants pegged at `m = 1 GiB` were never wired up
  anywhere. A 1 GiB allocation is not viable on mobile (iOS jetsams at ~2 GiB
  RSS for most devices) and is larger than any current threat model requires.

Findings **[H2]** (audit 2026-04-20, `crypto-z2eg`) and the corresponding ADR
gap motivated by `ps-h2gl` call for context-specific profiles backed by a
written rationale.

## Decision

Replace the single `PWHASH_OPSLIMIT_UNIFIED` / `PWHASH_MEMLIMIT_UNIFIED`
constants with three context-specific _profiles_ that callers select by intent:

| Profile      | opslimit | memlimit | Used by                                          |
| ------------ | -------- | -------- | ------------------------------------------------ |
| `TRANSFER`   | 3        | 32 MiB   | device-transfer short-lived key derivation       |
| `MASTER_KEY` | 4        | 64 MiB   | auth-key / password-key split derivation and PIN |

Each profile is exposed as a frozen, branded object in
`packages/crypto/src/crypto.constants.ts`:

```ts
export const ARGON2ID_PROFILE_TRANSFER: Argon2idProfile<"transfer"> = Object.freeze({
  opslimit: 3,
  memlimit: 32 * 1_024 * 1_024,
});

export const ARGON2ID_PROFILE_MASTER_KEY: Argon2idProfile<"master-key"> = Object.freeze({
  opslimit: 4,
  memlimit: 64 * 1_024 * 1_024,
});
```

Call sites read `PROFILE.opslimit` / `PROFILE.memlimit` rather than importing
loose scalar constants. This keeps the profile indivisible (you cannot mix the
opslimit of one tier with the memlimit of another by accident) and makes
intent explicit at the call site.

The `Argon2idProfile<K>` generic carries a phantom `unique symbol` brand (the
`K` parameter is `"master-key"` or `"transfer"`). The brand has no runtime
representation — libsodium still sees only `opslimit` and `memlimit` — but
the compiler uses it to reject passing a `TRANSFER` profile where a
`MASTER_KEY` profile is expected, closing the accidental-mix hole even when
future callers accept a profile as a parameter. A runtime validator
`assertArgon2idProfile` sits alongside the brand and checks the numeric
fields against the OWASP floor (m ≥ 19 MiB, t ≥ 1) before they reach
`pwhash` / `pwhashStr`, providing defence-in-depth for code paths that
bypass the brand (e.g., values sourced from runtime config).

### Why these numbers

The dominating reference is **OWASP ASVS 4.x V2.4.1** and the **OWASP Password
Storage Cheat Sheet** (2024), which recommend Argon2id with _at least_ `m >= 19
MiB, t >= 2, p = 1` for password hashing; `m >= 46 MiB, t >= 1` as an
alternative higher-memory configuration; and `m >= 64 MiB, t >= 3` when the
work can be amortized (login, key derivation).

- **MASTER_KEY** (`t = 4, m = 64 MiB`): exceeds the high-memory variant of the
  cheat sheet and matches the 2023 Argon2 recommendations for account-lifetime
  secrets. This is what the previous unified profile used; we are not
  regressing master-key security. The authKey derived here is the _only_
  secret that can recover the account after password change, so paying a
  few hundred ms of latency once per login is the correct trade.
- **TRANSFER** (`t = 3, m = 32 MiB`): the transfer code is used in a 5-minute
  relay window with server-side rate limiting; the offline-attack budget is
  bounded by an attacker's ability to capture both the encrypted payload and
  the salt during that window (ADR 024). The 32 MiB floor still exceeds the
  OWASP minimum and sits comfortably on mid-range mobile hardware, while
  shaving ~40% off latency vs the MASTER_KEY profile, which materially
  improves the pair-a-new-device experience on low-end Androids.
- **PIN** shares the MASTER_KEY profile rather than getting its own tier:
  PIN verification is a local-unlock gate that gains little from weaker
  parameters, and the 32 MiB drop would saddle littles-safe-mode and other
  frequent unlock flows with a weaker KDF than the master-key wrap used
  elsewhere in the same auth stack.

### Dropping the 1 GiB "SENSITIVE" constant

`PWHASH_OPSLIMIT_SENSITIVE = 4` and `PWHASH_MEMLIMIT_SENSITIVE = 1_073_741_824`
were present in `crypto.constants.ts` but not referenced by any production
code. Removing them closes three hazards:

1. A 1 GiB allocation on mobile would crash the process.
2. Dead constants get accidentally imported later by well-meaning contributors.
3. The "SENSITIVE" label misleads reviewers into thinking a 1 GiB tier is
   required for something; OWASP's own high-memory recommendation is 64 MiB.

We keep `PWHASH_OPSLIMIT_INTERACTIVE` and `PWHASH_OPSLIMIT_MODERATE` because
they are referenced from tests and the low-level `pwhash` adapter surface.

### Pre-release migration

Every derivation that previously used the unified profile is now a
`MASTER_KEY` derivation with identical `(t, m)` parameters — existing master-key
wrap / auth-key / PIN artifacts remain valid. The only behavioural change is
for device-transfer: keys derived with the new `TRANSFER` profile do not match
keys derived from the unified constants. Because a transfer session lives for
at most 5 minutes and is not persisted anywhere beyond that window, there is
no migration cost. Pluralscape is pre-release, so there is no concern about
cross-version transfer sessions spanning a deploy.

## Alternatives Considered

1. **Keep the unified profile.** Rejected: it either over-pays on the transfer
   flow (if we keep the MASTER_KEY numbers) or under-protects the master key
   (if we lower to mobile-friendly numbers). The unified shape forces us to
   solve the transfer UX problem by weakening the most valuable secret.
2. **Keep a 1 GiB SENSITIVE tier for "future high-value derivations."**
   Rejected: we have no such derivation today, and we cannot actually allocate
   1 GiB on the runtime targets that matter (Android mid-range, iOS). YAGNI.
   When a desktop-only derivation that warrants it appears, a new profile with
   a rationale can be added then.
3. **Per-profile salt sizes or Argon2 variants.** Rejected as scope creep; the
   salt size (16 B) and variant (Argon2id) are already correct for all three
   contexts.
4. **Bumping parallelism (`p`) beyond 1.** libsodium's `pwhash` hard-codes
   `p = 1`. Changing that requires switching off libsodium for Argon2, which
   is a far bigger decision than this ADR.

## Consequences

**Positive**

- Call sites read as _intent_ ("use the transfer profile") rather than _magic
  numbers_, and profiles are indivisible.
- Master-key derivations keep their current security margin; device-transfer
  KDF cost drops meaningfully on mobile.
- Removing the dead 1 GiB constants eliminates a foot-gun.

**Negative**

- Any third party that happened to consume `PWHASH_OPSLIMIT_UNIFIED` /
  `PWHASH_MEMLIMIT_UNIFIED` from `@pluralscape/crypto` must migrate to the
  named profiles. The package is pre-release and has no external consumers,
  so this cost is internal.
- Adding future profiles requires another ADR entry, by design.

## References

- OWASP ASVS 4.x V2.4.1 — Cryptographic Password Storage Requirements.
- OWASP Password Storage Cheat Sheet (2024) — Argon2id parameter guidance.
- ADR 024 — Device transfer code entropy trade-off (upstream threat context).
- `packages/crypto/src/crypto.constants.ts` — profile definitions.
- `packages/crypto/src/{auth-key,pin,device-transfer}.ts` — call sites.
