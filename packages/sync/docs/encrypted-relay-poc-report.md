# Encrypted CRDT Relay — POC Validation Report

## 1. Purpose

The sync layer is the single largest engineering risk in Pluralscape. ADR 005 chose Automerge + custom CRDT sync, and the document topology spec defines the full architecture — but before building API routes or the real sync protocol, three properties needed to be proven:

1. **Encrypted sync works** — Automerge changes can be encrypted with libsodium AEAD and distributed through a relay without breaking CRDT semantics
2. **Zero-knowledge relay** — the relay server stores only ciphertext and cannot read document content
3. **Conflict resolution** — concurrent edits from multiple clients merge correctly and deterministically after passing through the encrypted relay

This document records the results of the proof-of-concept that validates these properties.

## 2. Architecture

### 2.1 Why changes, not sync messages

Automerge provides a built-in sync protocol (`generateSyncMessage`/`receiveSyncMessage`) that uses bloom filters to determine what a specific peer is missing. This is a **stateful pairwise protocol** — it tracks per-peer state and assumes direct communication between two specific endpoints.

This is incompatible with a broadcast relay where any client can consume any message at any time. A relay-based architecture needs a stateless distribution mechanism.

The POC instead distributes **individual Automerge changes** through the relay:

```
Client A                     Relay (append-only log)          Client B
────────                     ──────────────────────           ────────

1. Automerge.change(doc, fn)
2. getLastLocalChange(doc)
   → raw change bytes
3. encryptChange(change)
   → EncryptedChangeEnvelope
                        ──submit(envelope)──→
                             appends ciphertext
                             (cannot decrypt)
                                                  ←─getEnvelopesSince(seq)──
                                                  4. decryptChange(envelope)
                                                     → raw change bytes
                                                  5. applyChanges(doc, [change])
                                                     → updated doc
```

This approach works because:

- `Automerge.getLastLocalChange(doc)` returns the raw bytes of the most recent local change
- `Automerge.applyChanges(doc, [change])` applies change bytes from any source
- Automerge handles deduplication internally — applying the same change twice is a no-op
- Automerge handles causal ordering internally — changes can arrive in any order
- No per-peer state is needed at the relay

### 2.2 Encryption envelope

Each change is wrapped in an `EncryptedChangeEnvelope`:

```
┌──────────────────────────────────────┐
│ ciphertext   │ AEAD-encrypted change │  XChaCha20-Poly1305
│ nonce        │ random per envelope   │  24 bytes
│ signature    │ Ed25519 over cipher   │  64 bytes
│ authorPubKey │ signer identity       │  32 bytes
│ documentId   │ plaintext routing     │  string
│ seq          │ relay-assigned        │  monotonic integer
└──────────────────────────────────────┘
```

**AEAD additional data (AD):** The `documentId` is bound into the AD, so ciphertext encrypted for one document cannot be replayed against a different document. The `seq` number is NOT included in the AD — it is assigned by the relay after encryption.

**Signature:** Ed25519 detached signature over the ciphertext (not the plaintext). This allows the relay to verify authorship without being able to decrypt, and allows clients to verify integrity before attempting decryption.

### 2.3 Snapshot envelope

Snapshots use the same pattern but bind `snapshotVersion` into the AD alongside `documentId`:

```
AD = documentId bytes ‖ snapshotVersion as BigUint64 (big-endian)
```

Explicit big-endian encoding via `DataView.setBigUint64(offset, value, false)` ensures cross-platform consistency.

### 2.4 Relay design

The relay is a pure append-only log with no access to encryption keys:

- `submit(envelope)` → appends ciphertext, assigns monotonic `seq`, returns `seq`
- `getEnvelopesSince(documentId, sinceSeq)` → returns envelopes with `seq > sinceSeq`
- `submitSnapshot(envelope)` → stores if version is strictly newer than current; rejects downgrades and equal versions
- `getLatestSnapshot(documentId)` → returns latest snapshot or null

No per-peer state. No routing logic. No decryption capability. Snapshot version monotonicity is enforced at the relay level.

### 2.5 Session management

`EncryptedSyncSession` wraps an Automerge document with encryption keys and tracks `lastSyncedSeq` to know what to fetch from the relay:

- `change(fn)` → mutates doc, encrypts the resulting change, returns envelope for relay submission
- `applyEncryptedChanges(envelopes)` → sorts by seq, decrypts and applies changes, updates `lastSyncedSeq`; rolls back doc and seq atomically on any failure
- `createSnapshot(version)` → encrypts `Automerge.save()` output
- `fromSnapshot(envelope, keys, sodium, lastSyncedSeq?)` → bootstraps a new session from an encrypted snapshot, optionally resuming from a known seq

### 2.6 Document origin requirement

A critical finding during implementation: **all sessions that sync through a relay must share the same Automerge document origin**. Automerge changes reference internal object IDs that are specific to their document's history. A change that pushes to `doc1.members` targets `doc1`'s internal list ID — applying it to an independently-created `doc2.members` silently produces no effect because `doc2` has different internal IDs.

In practice this means:

- The first client creates the document and distributes the initial state (via snapshot or initial changes)
- Other clients load from that snapshot or apply the full change history from the relay
- Cloning (`Automerge.clone()`) preserves the document origin

This is not a limitation — it matches the expected production flow where a system's documents are created once and synced to other devices.

## 3. Test Results

All 28 tests pass. Each test maps to a specific property being validated.

### 3.1 Encryption primitives (11 tests)

| Test | Description                                                                  | Result |
| ---- | ---------------------------------------------------------------------------- | ------ |
| 1.1  | `encryptChange` produces ciphertext different from plaintext                 | PASS   |
| 1.2  | `decryptChange` recovers original change bytes                               | PASS   |
| 1.3  | `decryptChange` throws with wrong encryption key                             | PASS   |
| 1.4  | `decryptChange` throws when ciphertext is tampered (signature fails)         | PASS   |
| 1.5  | `decryptChange` rejects envelope with wrong `documentId` (AD mismatch)       | PASS   |
| 1.6  | `verifyEnvelopeSignature` returns true for valid envelope                    | PASS   |
| 1.7  | `verifyEnvelopeSignature` returns false for tampered ciphertext              | PASS   |
| 1.8  | Snapshot encrypt/decrypt roundtrip preserves bytes                           | PASS   |
| 1.9  | Snapshot AD uses explicit big-endian encoding (wrong version fails)          | PASS   |
| 1.10 | `decryptSnapshot` throws `SignatureVerificationError` on tampered ciphertext | PASS   |
| 1.11 | `decryptSnapshot` throws with wrong encryption key                           | PASS   |

**What this proves:** The encryption layer correctly wraps and unwraps Automerge data. Tampering, wrong keys, and cross-document replay are all detected and rejected — for both changes and snapshots.

### 3.2 Relay storage (6 tests)

| Test | Description                                                     | Result |
| ---- | --------------------------------------------------------------- | ------ |
| 2.1  | Relay stores and returns envelopes with assigned seq numbers    | PASS   |
| 2.2  | `getEnvelopesSince` returns only envelopes after the given seq  | PASS   |
| 2.3  | Stored ciphertext is not valid Automerge data (opaque to relay) | PASS   |
| 2.4  | Relay assigns monotonically increasing seq numbers              | PASS   |
| 2.5  | Relay stores and returns snapshots                              | PASS   |
| 2.6  | Relay replaces old snapshot with newer one (compaction)         | PASS   |

**What this proves:** The relay operates as a pure ciphertext log. It cannot interpret the data it stores. Incremental fetch works correctly.

### 3.3 Full integration (11 tests)

| Test | Description                                                             | Result |
| ---- | ----------------------------------------------------------------------- | ------ |
| 3.1  | Two sessions sync a MemberProfile through the encrypted relay           | PASS   |
| 3.2  | Multiple changes propagate from one session to another                  | PASS   |
| 3.3  | Concurrent edits to different fields merge without conflict             | PASS   |
| 3.4  | Concurrent edits to same field produce deterministic LWW resolution     | PASS   |
| 3.5  | Concurrent edits resolve identically regardless of relay delivery order | PASS   |
| 3.6  | Applying the same encrypted envelopes twice is idempotent via seq-skip  | PASS   |
| 3.7  | Snapshot roundtrip preserves document state through encryption          | PASS   |
| 3.8  | Sync continues correctly after loading from a snapshot                  | PASS   |
| 3.9  | Three-way concurrent edit resolves deterministically                    | PASS   |
| 3.10 | Mid-batch decryption failure rolls back doc and `lastSyncedSeq`         | PASS   |
| 3.11 | Relay rejects snapshot version downgrade or equal version               | PASS   |

**What this proves:** The full pipeline works — Automerge CRDT semantics are fully preserved through the encryption and relay layers. Concurrent edits merge correctly. Delivery order doesn't affect the outcome. Replay is safe. Snapshots can bootstrap new clients. Partial failures are handled atomically, and snapshot version monotonicity is enforced.

## 4. Goal Validation Summary

| Goal                  | Status        | Evidence                                                                                                                                                                    |
| --------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encrypted sync works  | **Validated** | Tests 3.1, 3.2: changes encrypted with XChaCha20-Poly1305 transit through the relay and are correctly decrypted and applied on the other side                               |
| Zero-knowledge relay  | **Validated** | Tests 1.1, 2.3: the relay stores only ciphertext that is not interpretable as Automerge data; the relay API has no access to encryption keys                                |
| Conflict resolution   | **Validated** | Tests 3.3–3.5, 3.9: concurrent edits merge correctly, LWW resolution is deterministic, and the result is independent of delivery order — even with three concurrent writers |
| Replay safety         | **Validated** | Test 3.6: seq-skip deduplication ensures applying the same envelopes twice is a no-op                                                                                       |
| Snapshot bootstrap    | **Validated** | Tests 3.7, 3.8: encrypted snapshots can bootstrap new sessions, and incremental sync continues correctly after snapshot load                                                |
| Atomic batch rollback | **Validated** | Test 3.10: a corrupted envelope mid-batch rolls back both doc state and `lastSyncedSeq` to pre-batch values                                                                 |
| Snapshot monotonicity | **Validated** | Test 3.11: relay rejects snapshot submissions with version ≤ current, preventing version downgrades                                                                         |

## 5. Implications for Production Architecture

### What the POC confirms

- The secsync-inspired pattern (encrypt each change/snapshot, sign with Ed25519, distribute through a dumb relay) works with Automerge
- The relay can be trivially simple — an append-only log with seq-based incremental fetch
- No per-peer sync state is needed; Automerge's internal causal ordering handles everything
- Snapshot compaction works through encryption (save full doc state, encrypt, store)

### What remains to be built

- **WebSocket transport** — replace in-memory relay with WebSocket-based real-time distribution
- **Persistent storage** — relay needs durable storage (PostgreSQL or equivalent)
- **Key management integration** — connect to the key lifecycle system for per-document and per-bucket encryption keys
- **Document manifest** — server-side plaintext manifest for document discovery (per topology spec)
- **Multi-document sync** — managing multiple concurrent sync sessions across document types
- **Compaction strategy** — when to create snapshots, how to prune old changes
- **Error recovery** — handling network failures, partial syncs, and key rotation mid-sync

### Risks retired

The sync layer was identified as the single largest engineering risk in the architecture audit. This POC retires the core risk: **we now know that Automerge CRDT semantics survive encryption and relay distribution**. The remaining work is transport, storage, and integration — well-understood engineering problems rather than architectural unknowns.

## 6. Implementation Reference

The initial POC files listed below remain in `packages/sync/src/`, but the production codebase has grown substantially beyond the POC scope. The files below represent the core primitives validated by this POC; the full sync implementation now includes document types, factories, schemas, engine, offline queue, projections, partial replication, and more.

**POC core files (`packages/sync/src/`):**

| File                | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `types.ts`          | Type definitions for envelopes and keys               |
| `encrypted-sync.ts` | Encrypt/decrypt/sign/verify for changes and snapshots |
| `relay.ts`          | In-memory append-only ciphertext relay                |
| `sync-session.ts`   | Client session wrapping Automerge + encryption        |

**POC test files (`packages/sync/src/__tests__/`):**

| File                     | Tests | Coverage                                      |
| ------------------------ | ----- | --------------------------------------------- |
| `encrypted-sync.test.ts` | 11    | Encryption primitives (changes and snapshots) |
| `relay.test.ts`          | 6     | Relay storage and zero-knowledge              |
| `sync-session.test.ts`   | 11    | Full integration scenarios and error handling |

Dependencies added: `@pluralscape/crypto: "workspace:*"` (no external dependencies beyond what was already present).
