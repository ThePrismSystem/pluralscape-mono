# ADR 014: Lazy Key Rotation Protocol for Privacy Buckets

## Status

Accepted

## Context

ADR 006 specifies that on friend removal from a privacy bucket, the bucket key is rotated and all bucket content is re-encrypted with the new key. This is O(bucket_size) — a blocking, synchronous operation that either freezes the UI or creates race conditions between concurrent writers and the re-encryption process.

Architecture Audit 004 identified this as "Fix This Now" priority: the rotation protocol must be designed before T2 (per-bucket) encryption is implemented.

The core insight: **revocation** (security-critical, must be instant) and **re-encryption** (expensive, O(bucket_size), retryable) are separable concerns. The revoked friend loses API access immediately; old content is lazily re-encrypted in the background.

## Decision

**Split revocation from re-encryption.** Friend removal triggers immediate access revocation and new key generation, followed by client-driven lazy re-encryption of existing content.

### Rotation State Machine

```
revoke_friend → [initiated] → first chunk claimed → [migrating]
  → all items done → [sealing] → old key purged → [completed]
                                                 → [failed] (7-day timeout or exhausted retries)
```

| State       | Old key readable                  | New key writable     | Duration              |
| ----------- | --------------------------------- | -------------------- | --------------------- |
| `initiated` | Yes                               | Yes (all new writes) | Seconds               |
| `migrating` | Yes                               | Yes                  | Minutes–hours         |
| `sealing`   | Yes (briefly)                     | Yes                  | Seconds               |
| `completed` | No                                | Yes                  | Terminal              |
| `failed`    | Yes (data must remain accessible) | Yes                  | Until retry/supersede |

### Initiation Protocol (synchronous, <2s)

When a friend is removed from a bucket:

1. Generate a new 256-bit bucket key, increment the `keyVersion` on `EncryptedBlob`
2. Wrap the new key with the owner's MasterKey (DEK/KEK envelope), store on server
3. Revoke old key grants for the removed friend
4. Issue new key grants to remaining friends (encrypt new bucket key with each friend's X25519 public key)
5. Create a rotation ledger entry and populate rotation items from `BucketContentTag` records
6. Revoke the removed friend's active sessions
7. Notify the owner's other devices via the realtime channel (ADR 007)

All new writes to the bucket use the new key immediately after initiation. No writes with the old key are permitted after step 1 completes.

### Server-Side Rotation Ledger

The server tracks rotation progress as T3 metadata (no key material):

**`bucket_key_rotations`**

- `id`: rotation ID
- `bucketId`: the bucket being rotated
- `fromKeyVersion`: old key version
- `toKeyVersion`: new key version
- `state`: `initiated` | `migrating` | `sealing` | `completed` | `failed`
- `initiatedAt`: timestamp
- `completedAt`: timestamp or null
- `totalItems`: count of items to re-encrypt
- `completedItems`: count of items re-encrypted
- `failedItems`: count of items that failed re-encryption

**`bucket_rotation_items`**

- `rotationId`: FK to rotation
- `entityType`: from `BucketContentTag`
- `entityId`: from `BucketContentTag`
- `status`: `pending` | `claimed` | `completed` | `failed`
- `claimedBy`: device ID or null
- `claimedAt`: timestamp or null
- `completedAt`: timestamp or null
- `attempts`: retry count

### Client-Driven Re-encryption

The owner's devices perform re-encryption. The server never sees key material.

1. Device queries for pending rotation items (default chunk size: 50 items)
2. Device claims a chunk — server marks items as `claimed` with a 5-minute stale timeout
3. Device fetches the encrypted blobs for claimed items
4. For each item: decrypt with old key → re-encrypt with new key → upload with new `keyVersion`
5. Server marks items as `completed`
6. When all items are done, rotation transitions to `sealing` → old key is purged → `completed`

Multiple devices can work concurrently — each claims independent chunks. The stale claim timeout (5 minutes) ensures that if a device goes offline mid-chunk, others can reclaim the orphaned items.

### Dual-Key Read Window

During `initiated` and `migrating` states, clients must support reading both old and new keys:

- Check `EncryptedBlob.keyVersion` to determine which key to use
- Both old and new bucket keys are cached in memory during the rotation window
- After `completed`, clients drop the old key from cache

### Concurrent Rotation Serialization

Maximum one active rotation per bucket at any time.

- If a second friend is removed while a rotation is in `migrating` state: the friend's grants are revoked immediately (security), but the key rotation is queued to start after the current rotation completes
- If a second friend is removed while still in `initiated` state (no chunks claimed yet): the removals are batched into the same rotation — one new key replaces the old, covering both revocations

### Time Limits

| Metric                      | Target                        | Hard Limit |
| --------------------------- | ----------------------------- | ---------- |
| API access revocation       | Immediate (within initiation) | —          |
| Re-encryption (cloud)       | <15 minutes                   | 7 days     |
| Re-encryption (self-hosted) | <24 hours                     | 7 days     |
| Stale chunk claim           | —                             | 5 minutes  |

If a rotation exceeds the 7-day hard limit, it transitions to `failed` state. The old key is **not** deleted — data accessibility is preserved. The owner is alerted via push notification and in-app banner.

### Offline Device Handling

- Owner device comes online mid-rotation → joins the re-encryption effort by claiming available chunks
- Owner device comes online post-completion → updates its key cache (drops old key)
- All owner devices offline → rotation pauses, resumes on next session. The 7-day hard limit still applies from initiation time

### CRDT Integration

Re-encrypted blobs are written as normal Automerge changes (ADR 005) with the updated `keyVersion`. If two devices accidentally re-encrypt the same item (race past the claim mechanism), CRDT last-writer-wins produces a valid result — both encrypted the same plaintext under the same new key with different nonces, so either ciphertext is correct.

### Error Handling

| Scenario                     | Behavior                                           |
| ---------------------------- | -------------------------------------------------- |
| Single item fails 3x         | Marked `failed`, rotation continues, owner alerted |
| Initiation fails (steps 1–7) | Full rollback, no state change                     |
| Rotation exceeds 7 days      | `failed` state, old key NOT deleted                |
| Unknown `keyVersion` on read | Fail closed — deny access, log error               |

### Audit Trail

The following audit events are logged (extends `AuditEventType`):

- `bucket.key_rotation.initiated` — includes bucket ID, old/new key versions, removed friend ID
- `bucket.key_rotation.chunk_completed` — includes rotation ID, chunk size, device ID
- `bucket.key_rotation.completed` — includes rotation ID, total items, duration
- `bucket.key_rotation.failed` — includes rotation ID, failed item count, reason

### Security Model and Limitations

Key rotation protects **server-stored data** from the revoked friend. It does not protect against:

- Previously exfiltrated local copies of the old key or decrypted content
- Content the friend has already read and cached locally

This matches the security model of Etebase, Proton Drive, and Keeper — revocation prevents future access, not retroactive exfiltration. The threat model assumes that friends had legitimate access during the sharing period.

## Consequences

- Supersedes the ADR 006 consequence "Bucket key rotation on friend removal is O(bucket_size) — keep buckets reasonably sized" — buckets can now be any size, rotation is non-blocking
- Adds server-side complexity (rotation ledger, claim mechanism) but keeps crypto operations client-side
- The dual-key read window requires clients to cache two keys per bucket during rotation — bounded by the 7-day hard limit
- Rotation items are derived from `BucketContentTag` records — if tagging is inconsistent, items may be missed. The `sealing` state provides a final verification pass
- Self-hosted deployments with single-device owners may see slower rotations — the 24-hour target is generous, and the 7-day hard limit provides a safety net
- The `failed` state preserves data accessibility at the cost of leaving old-key content readable by anyone who still possesses the old key material (which should be no one, since grants are revoked)

### License

No new dependencies. Uses existing libsodium primitives (ADR 006).
