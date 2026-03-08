# Encryption Architecture Research: E2E Encryption for PluralScape

## Problem Statement

PluralScape stores highly sensitive psychiatric data (fronting logs, trauma journals, internal communication) and must implement:

- E2E encryption so the server never sees plaintext user data
- Encryption at rest on both client and server
- Multi-device access (web, iOS, Android)
- Selective sharing via Privacy Buckets where the server facilitates access control without reading data
- Self-hosting support (encryption must not depend on who runs the server)
- Client-side decryption for data export (readable JSON/CSV)
- Scale to 500K users

This is architecturally challenging because the server must facilitate _access control_ (Privacy Buckets determine which friends see which data) without being able to _read_ the data it's controlling access to.

---

## 1. Protocol Survey

### 1.1 Signal Protocol

**What it is:** The Signal Protocol (X3DH key agreement + Double Ratchet) provides E2E encryption with forward secrecy and post-compromise security. Used by Signal, WhatsApp (3B+ users), and Facebook Messenger.

**Applicability beyond messaging:**

- Designed for pairwise (1:1) encrypted channels. The Double Ratchet generates a new key per message, providing forward secrecy.
- Group messaging uses "Sender Keys" (GroupCipher): a sender distributes a symmetric group key to all members via pairwise Olm/X3DH channels. Messages are encrypted once with the group key and broadcast.
- The protocol handles multi-device by treating each device as a separate "participant" that needs its own pairwise session.

**Fit for PluralScape:** Poor to moderate. Signal Protocol is optimized for _ephemeral message streams_ with continuous ratcheting. PluralScape's data model is _persistent state_ (member profiles, fronting status, notes) that gets read repeatedly, not message streams. The continuous ratcheting adds complexity without benefit for stored documents. The Sender Keys pattern for groups is relevant to Privacy Buckets, but Signal Protocol overall is overkill for non-messaging E2E encryption.

**Verdict:** Borrow the _concepts_ (per-group symmetric keys distributed via asymmetric encryption) but do not implement the full Signal Protocol.

### 1.2 Matrix/Olm/Megolm

**What it is:** Matrix's encryption layer uses two protocols:

- **Olm:** Pairwise encrypted channels between two devices (based on Double Ratchet, similar to Signal)
- **Megolm:** Group encryption. Each user creates an "outbound Megolm session" with a ratcheting key. The session key is distributed to all room members (and the user's own other devices) via Olm-encrypted to-device messages.

**Key architectural details:**

- One Megolm session per user per room. The ratchet goes forward only (new members can decrypt future messages but not past ones unless explicitly given older keys).
- Multi-device key sharing happens three ways: (1) Olm-encrypted `m.room_key` events when first sending, (2) `m.forwarded_room_key` events between a user's own devices, (3) Server-side key backup encrypted with a backup key the server never sees.
- The server stores encrypted blobs and metadata (who is in which room, message ordering) but cannot decrypt content.

**Fit for PluralScape:** Moderate. The Megolm pattern of "per-group symmetric key, distributed via pairwise asymmetric channels" maps well to Privacy Buckets. The key backup mechanism is relevant for multi-device. However, the ratcheting (designed so old keys expire) is counterproductive for persistent data that needs to remain readable. Matrix also discovered real vulnerabilities in its key verification flows, so any adoption would need careful security design.

**Verdict:** The Megolm _distribution pattern_ (per-bucket symmetric key shared via asymmetric encryption to authorized users) is the right mental model. Skip the ratcheting.

### 1.3 MLS (Messaging Layer Security) - IETF RFC 9420

**What it is:** Published July 2023, MLS is the IETF's standardized group key agreement protocol. It uses a tree-based key structure (TreeKEM) for efficient group key updates. Designed for groups of 2 to thousands.

**Key properties:**

- Forward secrecy and post-compromise security
- Efficient member add/remove (O(log n) operations via tree structure)
- "Exporter" mechanism allows deriving additional encryption keys for non-messaging uses (e.g., encrypting media streams, file storage)
- Cross-industry standard with adoption by Google Messages (RCS), Apple Messages, Discord (mandatory E2E for A/V as of March 2026)

**Fit for PluralScape:** The Exporter mechanism makes MLS applicable beyond messaging. A Privacy Bucket could be modeled as an MLS group, with the exported key used to encrypt bucket data. However, MLS is heavyweight infrastructure primarily designed for real-time session key agreement. PluralScape's sharing model is more static (friend added to bucket, gains access to all bucket data) than dynamic (group membership changing frequently during active sessions).

**Verdict:** Worth tracking as an emerging standard. For V1, the simpler "per-bucket symmetric key" approach is more practical. MLS could be adopted later for inter-system direct messaging.

### 1.4 libsodium (NaCl)

**What it is:** A portable, audited cryptographic library providing high-level primitives. Fork of NaCl with an extended API.

**Cross-platform availability:**

- **Web:** libsodium.js (full JS/WASM port, fully supported)
- **iOS:** CocoaPod `libsodium-ios`, also available via Swift packages
- **Android:** Available via JNI bindings, Kotlin/Java wrappers
- **Flutter:** Available via FFI (dart:ffi) for both iOS and Android
- **Node.js:** `sodium-native` and `libsodium-wrappers`

**Relevant primitives:**

- `crypto_secretbox` (XSalsa20-Poly1305): Symmetric authenticated encryption for data blobs
- `crypto_box` (X25519 + XSalsa20-Poly1305): Authenticated public-key encryption for key exchange
- `crypto_box_seal` (Sealed boxes): Anonymous public-key encryption (sender cannot decrypt their own message; server cannot see content)
- `crypto_pwhash` (Argon2id): Password-based key derivation
- `crypto_sign` (Ed25519): Digital signatures for data integrity
- `crypto_kdf`: Key derivation for creating sub-keys from a master key
- `crypto_aead_xchacha20poly1305_ietf`: AEAD encryption (what Standard Notes uses)

**Fit for PluralScape:** Excellent. libsodium is the _implementation layer_. It provides all the cryptographic primitives needed. Standard Notes, Etebase, and many other E2E apps build on it. The cross-platform story is strong. The API is designed to be hard to misuse (safe defaults, no algorithm negotiation).

**Verdict:** Use libsodium as the primary cryptographic library. It is the clear choice.

### 1.5 Web Crypto API + Platform-Native Crypto

**What it is:** The W3C Web Cryptography API (`SubtleCrypto`) provides browser-native cryptographic operations. Available as `window.crypto.subtle` in browsers and Node.js.

**Cross-platform story:**

- Browsers: Universally supported in modern browsers. Supports AES-GCM, RSA-OAEP, ECDH, PBKDF2, HKDF.
- Node.js: Full `crypto.webcrypto` support
- iOS/Android: Not natively available (would need to use platform APIs: CommonCrypto/CryptoKit on iOS, java.security/AndroidKeyStore on Android)

**Limitations:**

- No XChaCha20-Poly1305 (the modern AEAD choice). Limited to AES-GCM which has nonce-reuse catastrophes.
- No Argon2id (must use PBKDF2, which is weaker for password hashing).
- No X25519 (must use ECDH with P-256, which has a less clean security story).
- The API is low-level and error-prone. No "sealed box" equivalent.
- Different key storage semantics per platform.

**Fit for PluralScape:** Poor as a primary choice. The algorithm selection is more limited and older than libsodium's. Cross-platform consistency is worse because iOS and Android don't have Web Crypto natively, so you'd need different implementations per platform anyway.

**Verdict:** Skip. Use libsodium, which provides better algorithms, a safer API, and true cross-platform consistency. Web Crypto could be a fallback for web-only scenarios but is unnecessary with libsodium.js.

---

## 2. Key Management on Mobile

### 2.1 iOS Keychain

- Encrypted storage service for passwords, tokens, certificates, and keys
- Uses device-based encryption + Secure Enclave (hardware-backed) on supported devices
- Manages encryption automatically; stores the data itself in an encrypted database
- Supports access control: keys can require biometric auth (FaceID/TouchID) before access
- Items can be synced via iCloud Keychain (relevant for multi-device)
- Accessible via `Security.framework` and higher-level wrappers

**Use for PluralScape:** Store the user's private key (X25519) and master encryption key in the iOS Keychain with biometric access control. The Keychain persists across app reinstalls if configured with the right accessibility class.

### 2.2 Android Keystore

- Framework for generating and storing cryptographic keys securely
- Hardware-backed isolation via TEE (Trusted Execution Environment) or StrongBox (Secure Element)
- Manages only encryption _keys_, not arbitrary data (unlike iOS Keychain)
- Keys can be bound to biometric authentication
- Keys are automatically deleted on factory reset
- Does NOT sync across devices (no Android equivalent of iCloud Keychain)

**Use for PluralScape:** Store the user's private key in the Android Keystore with biometric binding. Use `EncryptedSharedPreferences` (backed by Keystore) for other sensitive config data.

### 2.3 Web (Browser)

- No hardware-backed key storage equivalent
- `IndexedDB` can store `CryptoKey` objects (non-extractable if using Web Crypto)
- LocalStorage/SessionStorage is NOT suitable for key material
- Browser extensions or OS-level credential managers can help but are not reliable
- The weakest link in the chain: key material is fundamentally accessible to JavaScript

**Use for PluralScape:** Derive the master key from the user's password (Argon2id) on every session start. Optionally cache the derived key in-memory or in an encrypted IndexedDB entry for the session duration. Never persist private keys in browser storage across sessions.

### 2.4 Cross-Platform Key Strategy

| Platform | Key Storage                                    | Key Persistence                           | Biometric Gate   |
| -------- | ---------------------------------------------- | ----------------------------------------- | ---------------- |
| iOS      | Keychain (Secure Enclave)                      | Survives reinstall                        | FaceID/TouchID   |
| Android  | Keystore (TEE/StrongBox)                       | Survives reinstall, lost on factory reset | Fingerprint/Face |
| Web      | In-memory (derived from password each session) | Session-only                              | N/A              |

---

## 3. How Other Apps Solve This

### 3.1 Standard Notes

**Architecture:**

- Password-derived keys using Argon2id
- All notes encrypted with XChaCha20-Poly1305
- Server is treated as explicitly _non-trustworthy_; the spec says "requires a trustworthy application but not a trustworthy server"
- Data is encrypted client-side before upload, signed for integrity
- Local persistence stores encrypted with the account master key, stored in device Keychain/Keystore
- Optional application passcode wraps the master key with an additional encryption layer
- Open source, audited four times

**Relevance to PluralScape:** Standard Notes demonstrates the "password-derived master key + encrypt everything client-side" pattern. However, Standard Notes does NOT have sharing between users (no equivalent to Privacy Buckets). Their model is single-user only.

### 3.2 Proton (Mail/Drive)

**Architecture:**

- Each user has an RSA key pair (or newer ECC). Private key encrypted with user's mailbox password using AES-256.
- Zero-access encryption: even emails from non-Proton users are encrypted on arrival with the recipient's public key
- **Sharing model (Proton Drive):** When sharing a folder, a 32-byte random share passphrase is generated. An asymmetric share key is created. The share passphrase is encrypted with _each member's_ address key. Each member decrypts the share passphrase with their own private key, then uses it to access the shared content.
- Large files split into 4MB chunks, each signed with a hash for integrity
- Password-protected sharing for external users (symmetric key derived from shared password)

**Relevance to PluralScape:** Proton Drive's sharing model is _directly applicable_ to Privacy Buckets. The pattern is: per-share symmetric key, encrypted individually for each authorized user with their public key. This is the approach PluralScape should use.

### 3.3 Etebase

**Architecture:**

- Open-source E2E encrypted backend (Firebase alternative)
- Built on libsodium for all crypto operations
- Argon2id for password-based key derivation
- Data organized into "Collections" (like folders) and "Items"
- Collections are encrypted, signed, have immutable types, and _can be shared with other users with access control_ (admin, read, write permissions)
- Server is a dumb storage layer; all crypto happens client-side
- Self-hostable

**Relevance to PluralScape:** Etebase is the closest existing architecture to what PluralScape needs. Its Collections map to Privacy Buckets. It already solves sharing between users with per-collection encryption keys, uses libsodium, and is self-hostable. PluralScape could potentially _use Etebase_ as a backend or at minimum closely follow its encryption protocol design.

### 3.4 Keeper (Password Manager)

**Architecture:**

- Each vault record encrypted with a unique client-generated 256-bit AES key
- Record keys wrapped by Shared Folder keys
- Shared Folder keys distributed to members via public-key encryption
- Hierarchical key wrapping: Master Password -> Data Key -> Folder Keys -> Record Keys

**Relevance to PluralScape:** The hierarchical key wrapping pattern (master key -> bucket keys -> item keys) is relevant. Per-record encryption keys mean revoking access to a bucket only requires re-encrypting the bucket key, not re-encrypting all data.

---

## 4. Recommended Architecture: Privacy Buckets with E2E Encryption

### 4.1 Core Design

The fundamental insight from Proton Drive, Etebase, and Keeper is the same pattern:

**Per-Bucket Symmetric Key + Asymmetric Key Distribution**

```
User creates Privacy Bucket "Trusted Friends"
  -> Client generates a random 256-bit symmetric key (BucketKey_TF)
  -> All content tagged with "Trusted Friends" is encrypted with BucketKey_TF
  -> When Friend A is assigned to "Trusted Friends":
     -> Client fetches Friend A's public key from server
     -> Client encrypts BucketKey_TF with Friend A's public key
     -> Encrypted blob stored on server as a "key grant"
  -> Friend A's device:
     -> Fetches the key grant
     -> Decrypts BucketKey_TF using their private key
     -> Uses BucketKey_TF to decrypt bucket content
```

The server stores: encrypted content, encrypted key grants, public keys, and bucket membership metadata. The server NEVER sees: plaintext content, bucket symmetric keys, or users' private keys.

### 4.2 Key Hierarchy

```
User's Password
  |
  v (Argon2id, 256MB memory, 3 iterations)
Master Key (256-bit)
  |
  +---> Identity Key Pair (X25519 for encryption, Ed25519 for signing)
  |       Private key encrypted with Master Key, stored on server
  |       Public key stored on server in cleartext
  |
  +---> Per-Bucket Keys (XChaCha20-Poly1305 symmetric keys)
  |       Each encrypted with Master Key for the user's own access
  |       Each encrypted with each authorized friend's public key
  |
  +---> Per-Device Auth Keys (for session management)
```

### 4.3 Data Encryption Model

**What gets encrypted (per-field, not per-record):**

| Data Type      | Encrypted Fields                                       | Plaintext Metadata (server can see)                                |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Member Profile | Name, pronouns, description, custom fields, avatar URL | Record ID, creation timestamp, bucket tags (as opaque IDs)         |
| Front Entry    | Who is fronting (member ref), comments                 | Start/end timestamps (needed for server-side queries), bucket tags |
| Chat Message   | Content, attachments                                   | Timestamp, channel ID, sender proxy ID (opaque)                    |
| Board Message  | Content                                                | Priority order, timestamp                                          |
| Notes          | Content, title                                         | Associated member ID (opaque), timestamp                           |
| Custom Front   | Name, description                                      | Record ID, color code (needed for friend dashboard rendering?)     |

**Design decision:** Timestamps and structural metadata (ordering, relationships between records) remain in plaintext so the server can perform sync, ordering, and pagination. The _content_ is always encrypted. This is the same tradeoff Standard Notes, Proton, and Etebase all make.

**Alternative consideration:** Even timestamps could be encrypted if fronting times are considered sensitive (they reveal when switches happen). This would require client-side sorting/filtering only, which impacts performance at scale but maximizes privacy. Recommend making this configurable: "Maximum Privacy" mode encrypts timestamps too.

### 4.4 Privacy Bucket Access Control Flow

```
1. System owner creates bucket "Partner Only"
   -> Client generates BucketKey_PO (random 256-bit)
   -> BucketKey_PO encrypted with owner's Master Key -> stored on server

2. Owner tags member "Child Alter" with "Partner Only"
   -> Member profile encrypted with BucketKey_PO
   -> Server stores: {member_id: abc, buckets: ["PO"], encrypted_data: <blob>}

3. Owner adds Friend (partner) and assigns bucket "Partner Only"
   -> Client fetches partner's public key
   -> Client encrypts BucketKey_PO with partner's public key -> key grant stored on server
   -> Server stores: {friend_id: xyz, bucket: "PO", encrypted_key: <blob>}

4. Partner's device requests current fronters
   -> Server checks: which buckets does friend xyz have grants for? -> ["PO"]
   -> Server returns: all currently-fronting members tagged with bucket "PO", as encrypted blobs
   -> Partner's client decrypts with BucketKey_PO

5. Owner removes partner from "Partner Only" bucket
   -> Server deletes the key grant for friend xyz / bucket PO
   -> Client generates NEW BucketKey_PO2, re-encrypts all "Partner Only" content
   -> Remaining authorized friends get new key grants with BucketKey_PO2
```

**Step 5 is the expensive operation** -- revoking access requires key rotation and re-encryption of all data in that bucket. This is unavoidable in true E2E encryption (the revoked friend still has the old key in memory). Mitigation strategies:

- Keep buckets reasonably sized
- Lazy re-encryption (re-encrypt on next edit, mark old versions as stale)
- The friend's client can be de-authorized via server-side token revocation immediately (they lose API access), and key rotation can happen in the background

### 4.5 Multi-Device Support

**Adding a new device:**

```
1. User logs in on new device with password
2. Password -> Argon2id -> Master Key (deterministic, same on every device)
3. Client fetches encrypted private key from server
4. Decrypts private key with Master Key
5. Client fetches all encrypted bucket keys
6. Decrypts bucket keys with Master Key
7. Device is now fully operational
```

The password-derived approach means NO device-to-device key transfer is needed (unlike Matrix, which requires cross-signing verification). The tradeoff is that the password must be strong enough to resist offline brute-force (Argon2id with high memory cost mitigates this).

**Device-specific considerations:**

- Mobile (iOS/Android): After initial derivation, store Master Key in Keychain/Keystore behind biometric lock. Re-derive only on fresh install.
- Web: Re-derive Master Key from password on every session. Keep in memory only. Clear on tab close.

### 4.6 Self-Hosting Compatibility

The encryption architecture is **inherently self-hosting compatible** because:

- The server never has key material. It's a dumb encrypted blob store + metadata router.
- Key derivation is client-side (Argon2id). No HSM or cloud KMS dependency.
- Public key directory is just a database table. No certificate authority needed.
- The server's only trust role is: faithfully delivering encrypted blobs and not lying about public keys.

**Trust-on-first-use (TOFU) risk:** A malicious self-hosted server could substitute a fake public key when a user requests a friend's public key, enabling a MITM attack. Mitigation:

- Display a "Safety Number" (like Signal) derived from both users' public keys
- Users can out-of-band verify this number
- Optionally, publish public key fingerprints to a transparency log or blockchain anchor

### 4.7 Data Export

```
1. User requests export on client
2. Client fetches all encrypted data from server
3. Client decrypts everything using Master Key + Bucket Keys
4. Client formats plaintext data as JSON/CSV
5. File is generated entirely client-side and saved locally
6. No plaintext ever touches the server
```

This is straightforward because all keys are derived from the password. Any device with the password can decrypt everything.

### 4.8 Friend Dashboard (Real-Time Fronting Status)

The friend's read-only dashboard showing current fronters requires:

```
1. When a switch happens, the system owner's client:
   a. Encrypts the fronting status update with each relevant BucketKey
   b. Pushes encrypted blobs to server, tagged with bucket IDs

2. Server receives push, stores encrypted status
   Server knows: "system X has a new fronting event" and which bucket IDs it's tagged with
   Server does NOT know: who is fronting or any details

3. Server sends push notification to authorized friends:
   Server checks which friends have key grants for the tagged buckets
   Sends encrypted blob to those friends' devices

4. Friend's device decrypts and displays the fronter information
```

**Push notification content:** The push notification payload itself should NOT contain the fronter's name (the server can see push payloads). Instead, send a "new fronting event" signal, and the friend's app fetches + decrypts the details on wakeup.

---

## 5. Encryption at Rest

### 5.1 Client-Side (Device)

| Platform | Technology                                     | Key Storage                       |
| -------- | ---------------------------------------------- | --------------------------------- |
| iOS      | SQLCipher (encrypted SQLite)                   | Keychain (Secure Enclave)         |
| Android  | SQLCipher (encrypted SQLite)                   | Keystore (TEE/StrongBox)          |
| Web      | In-memory only; optionally encrypted IndexedDB | Derived from password per session |

SQLCipher provides AES-256 full-database encryption for SQLite. The database key is the Master Key (or a derived sub-key). On mobile, this key is stored in the platform secure enclave behind biometric authentication.

### 5.2 Server-Side

Even though all _user content_ is already E2E encrypted (the server only stores ciphertext), server-side encryption at rest provides defense-in-depth:

- **Database:** Use PostgreSQL with Transparent Data Encryption (TDE) or full-disk encryption (LUKS on Linux)
- **File storage (avatars, attachments):** Encrypted at the storage layer (e.g., S3 SSE-S3, or LUKS for self-hosted)
- **Backups:** Must also be encrypted. Server operator should manage backup encryption keys separately.

This protects against physical disk theft or cloud provider data breaches. It does NOT protect against a compromised server runtime (which is why E2E encryption is the primary protection layer).

---

## 6. Scale Considerations (500K Users)

### 6.1 Key Distribution

- Each user has 1 key pair: 500K public keys in the directory. Trivial for any database.
- Each Privacy Bucket generates 1 symmetric key. If average user has 5 buckets with 10 friends each, that's 2.5M key grants. Still trivial.
- Key grants are small (~128 bytes each). Total key grant storage: ~320MB. Negligible.

### 6.2 Encryption Overhead

- XChaCha20-Poly1305 is extremely fast: >1GB/s on modern hardware
- Per-field encryption adds ~40 bytes overhead (24-byte nonce + 16-byte auth tag) per encrypted field
- For a member profile with 10 encrypted fields: ~400 bytes overhead. Negligible.
- Client-side Argon2id key derivation: ~1-2 seconds on mobile (configurable). One-time cost per session.

### 6.3 Key Rotation on Revocation

- Worst case: a bucket with 1000 members gets its key rotated. Must re-encrypt 1000 records and generate new key grants for all remaining friends.
- At XChaCha20 speeds, re-encrypting 1000 records takes <100ms client-side
- The bottleneck is uploading re-encrypted data: ~100KB, well under 1 second on any connection
- This is a per-bucket operation, not a global operation. Does not affect other users.

### 6.4 Friend Dashboard Push Updates

- When a system with 50 friends switches fronters, server must deliver 50 push notifications
- This is identical to any messaging app's fanout. Standard infrastructure (FCM/APNs) handles this trivially.
- The encrypted payload is ~256 bytes per friend. Total bandwidth per switch: ~12.5KB. Negligible.

---

## 7. Recommended Technology Stack

| Component                      | Technology                                                              | Rationale                                                         |
| ------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Cryptographic library          | **libsodium** (via platform bindings)                                   | Audited, cross-platform, safe API, all needed primitives          |
| Key derivation                 | **Argon2id** (libsodium `crypto_pwhash`)                                | Current best practice, memory-hard, resistant to GPU/ASIC attacks |
| Symmetric encryption           | **XChaCha20-Poly1305** (libsodium `crypto_aead_xchacha20poly1305_ietf`) | No nonce-reuse risk (24-byte nonce), fast, authenticated          |
| Asymmetric encryption          | **X25519 + XSalsa20-Poly1305** (libsodium `crypto_box`)                 | Modern elliptic curve, fast, small keys                           |
| Signing                        | **Ed25519** (libsodium `crypto_sign`)                                   | For data integrity verification                                   |
| Local database encryption      | **SQLCipher**                                                           | AES-256 full-database encryption for SQLite                       |
| Password hashing               | **Argon2id** (256MB memory, 3 iterations recommended)                   | Tunable for mobile performance                                    |
| Key storage (iOS)              | **Keychain Services** with Secure Enclave                               | Hardware-backed, biometric gating                                 |
| Key storage (Android)          | **Android Keystore** with StrongBox                                     | Hardware-backed, biometric gating                                 |
| Key storage (Web)              | **In-memory only** (derived per session)                                | No persistent key storage in browsers                             |
| Server-side encryption at rest | **PostgreSQL TDE or LUKS** + encrypted object storage                   | Defense-in-depth layer                                            |

---

## 8. Open Questions and Risks

### 8.1 Password Strength Dependency

The entire security model depends on the user's password. Weak passwords mean weak encryption. Mitigations:

- Enforce minimum password complexity (zxcvbn score >= 3)
- Use high-cost Argon2id parameters (256MB memory makes brute-force expensive)
- Consider optional passphrase-based approach (4+ random words) with strength meter
- Optional: support hardware security keys (FIDO2/WebAuthn) as a second factor for key derivation

### 8.2 Key Loss = Data Loss

If a user forgets their password and has no active device session, all data is irrecoverable. This is inherent to zero-knowledge E2E encryption. Mitigations:

- Encourage users to write down a recovery key (a separate high-entropy key that can decrypt the master key)
- Support "trusted device" recovery (an existing logged-in device can authorize a new one)
- Social recovery (N-of-M threshold: user gives encrypted key shares to trusted friends, any 3 of 5 can reconstruct the master key). Requires careful UX.
- Clear user education: "If you lose your password and recovery key, your data cannot be recovered by anyone, including us."

### 8.3 Metadata Leakage

Even with E2E encryption, the server sees:

- Who is friends with whom
- When switches happen (timestamps)
- Bucket membership graphs (which friends have which buckets)
- Request patterns (when users are active)

Full metadata protection is extremely expensive (requires techniques like PIR, ORAM, or mixnets). For V1, accept this tradeoff and document it transparently. Consider encrypting timestamps in a "Maximum Privacy" mode for users who need it.

### 8.4 Browser Security Model

Web clients are inherently weaker because:

- JavaScript can be tampered with by a compromised server (serve malicious JS that exfiltrates keys)
- No hardware-backed key storage
- Browser extensions can read page content

Mitigations:

- Publish a Subresource Integrity (SRI) hash of all JS bundles
- Support browser extension or desktop app for higher-security users
- Consider a "web verification" page where users can compare the JS hash against a published value

### 8.5 Bucket Intersection Leakage

The server knows which bucket IDs are assigned to which content and which friends. While it cannot read the bucket names or content, it can observe the _graph structure_. For example, it can see "friend A has access to buckets [1,3,5] and friend B has access to buckets [2,3]." This is necessary for the server to route data correctly.

Mitigation: Use opaque random UUIDs for bucket IDs (not sequential integers). The server cannot infer meaning from the IDs themselves.

### 8.6 Concurrent Editing and Conflict Resolution

With E2E encryption, the server cannot merge conflicting edits (it can't read them). All conflict resolution must happen client-side. For PluralScape this is less critical than for collaborative document editing -- most data is append-only (fronting logs) or single-writer (member profiles edited by the system owner only).

---

## 9. Implementation Phases

### Phase 1: Core Encryption (MVP)

- Password-derived master key (Argon2id)
- Per-user key pair (X25519/Ed25519)
- All user content encrypted with master key (single-user, no sharing yet)
- SQLCipher for local database
- Encrypted sync to server
- Client-side data export

### Phase 2: Privacy Buckets with E2E Sharing

- Per-bucket symmetric keys
- Key grants for friends (asymmetric encryption of bucket keys)
- Friend dashboard with encrypted push
- Bucket membership management
- Key rotation on friend removal

### Phase 3: Advanced Features

- Recovery key generation and social recovery
- Inter-system direct messaging (consider MLS for this)
- Encrypted search (client-side search index, or searchable encryption scheme)
- Maximum Privacy mode (encrypted timestamps)
- Audit log of key grants and access

---

## 10. Comparison with Existing Solutions

| Feature                  | Standard Notes     | Proton Drive             | Etebase              | PluralScape (Proposed)                   |
| ------------------------ | ------------------ | ------------------------ | -------------------- | ---------------------------------------- |
| E2E Encryption           | Yes                | Yes                      | Yes                  | Yes                                      |
| Sharing between users    | No                 | Yes (per-share keys)     | Yes (per-collection) | Yes (per-bucket keys)                    |
| Selective access control | N/A                | Per-share permissions    | Per-collection ACL   | Privacy Bucket matrix (tag intersection) |
| Self-hostable            | Yes                | No                       | Yes                  | Yes                                      |
| Crypto library           | libsodium          | OpenPGP.js + custom      | libsodium            | libsodium                                |
| Key derivation           | Argon2id           | bcrypt (legacy) / Argon2 | Argon2id             | Argon2id                                 |
| Symmetric cipher         | XChaCha20-Poly1305 | AES-256                  | XChaCha20-Poly1305   | XChaCha20-Poly1305                       |
| Multi-device             | Password-derived   | Password-derived         | Password-derived     | Password-derived                         |
| Open source              | Yes                | Partial                  | Yes                  | Yes (planned)                            |

---

## Sources

- [End-to-end encryption - Wikipedia](https://en.wikipedia.org/wiki/End-to-end-encryption)
- [Signal Protocol - Wikipedia](https://en.wikipedia.org/wiki/Signal_Protocol)
- [Signal Protocol Documentation](https://signal.org/docs/)
- [Signal Private Group System](https://eprint.iacr.org/2019/1416.pdf)
- [Matrix E2E Encryption Implementation Guide](https://matrix.org/docs/matrix-concepts/end-to-end-encryption/)
- [Megolm group ratchet spec](https://spec.matrix.org/v1.17/olm-megolm/megolm/)
- [Matrix Olm/Megolm Analysis](https://blog.jabberhead.tk/2019/03/10/a-look-at-matrix-orgs-olm-megolm-encryption-protocol/)
- [Matrix Cryptographic Key Infrastructure](https://sumnerevans.com/posts/matrix/cryptographic-key-infrastructure/)
- [RFC 9420 - MLS Protocol](https://datatracker.ietf.org/doc/rfc9420/)
- [MLS Architecture RFC 9750](https://www.rfc-editor.org/rfc/rfc9750.html)
- [IETF MLS Overview](https://www.ietf.org/blog/mls-secure-and-usable-end-to-end-encryption/)
- [libsodium Documentation](https://doc.libsodium.org/)
- [libsodium Sealed Boxes](https://doc.libsodium.org/public-key_cryptography/sealed_boxes)
- [libsodium GitHub](https://github.com/jedisct1/libsodium)
- [Web Crypto API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [SubtleCrypto - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [Standard Notes Encryption Whitepaper](https://standardnotes.com/help/security/encryption)
- [Standard Notes Security](https://standardnotes.com/help/3/how-does-standard-notes-secure-my-notes)
- [Proton E2E Encryption](https://proton.me/security/end-to-end-encryption)
- [Proton Drive Security Model](https://proton.me/blog/protondrive-security)
- [Proton Zero-Access Encryption](https://proton.me/security/zero-access-encryption)
- [Etebase Documentation](https://docs.etebase.com/overview)
- [Etebase Protocol Specs](https://docs.etebase.com/protocol-specs/introduction)
- [Etebase FOSDEM 2021 Slides](https://archive.fosdem.org/2021/schedule/event/etebase/attachments/slides/4535/export/events/attachments/etebase/slides/4535/Etebase.pdf)
- [Keeper Encryption Model](https://docs.keeper.io/en/enterprise-guide/keeper-encryption-model)
- [Virgil E3Kit Group Encryption](https://developer.virgilsecurity.com/docs/e3kit/end-to-end-encryption/group-chat/)
- [iOS Keychain vs Android Keystore](https://docs.talsec.app/appsec-articles/articles/ios-keychain-vs.-android-keystore)
- [Android Keystore System](https://developer.android.com/privacy-and-security/keystore)
- [SQLCipher](https://www.zetetic.net/sqlcipher/)
- [Attribute-Based Encryption for Fine-Grained Access Control](https://eprint.iacr.org/2006/309.pdf)
- [Multiparty Selective Disclosure using ABE](https://arxiv.org/html/2505.09034v1)
- [HIPAA Encryption Requirements 2025](https://www.keragon.com/hipaa/hipaa-explained/hipaa-encryption-requirements)
- [E2E Encrypted Group Messaging Challenges](https://tjerandsilde.no/files/GroupMessagingReport.pdf)
- [Proxy Re-Encryption Between Groups](https://dl.acm.org/doi/10.1145/3288599.3299722)
