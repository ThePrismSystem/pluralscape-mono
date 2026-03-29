# ADR 029: Server-Side Encrypted Email Storage

## Status

Accepted

## Context

Pluralscape needs the ability to send emails to users for account recovery,
notifications, and other operational purposes. Currently, only a BLAKE2b hash
of the email is stored (for deterministic lookup), which is intentionally
one-way and cannot be reversed.

The server must be able to decrypt the email to send messages, ruling out
end-to-end encryption where only the client holds the key. However, storing
emails in plaintext exposes them in database dumps, backups, and to any operator
with read access.

This situation is analogous to push notification tokens (ADR 015), where the
server must read the value to perform its function. However, email addresses are
more sensitive than push tokens -- they are personally identifiable information
and a common vector for phishing and account takeover attacks. A stronger
protection is warranted.

## Decision

Add an `encrypted_email` nullable `bytea` column to the `accounts` table. The
email is encrypted server-side using XChaCha20-Poly1305 (AEAD) with a
server-held symmetric key (`EMAIL_ENCRYPTION_KEY` environment variable, 32-byte
hex-encoded).

- **Encryption**: `encryptEmail(email)` normalizes (lowercase + trim), encrypts
  with a random nonce, and returns the combined nonce + ciphertext as bytes.
- **Decryption**: `decryptEmail(ciphertext)` splits nonce from ciphertext,
  decrypts, and returns the plaintext email string.
- **Resolution**: `resolveAccountEmail(accountId)` fetches the encrypted column
  and decrypts it, returning `null` for accounts that predate this column or
  have no email stored.

The existing `email_hash` column remains for deterministic lookups. Registration
stores both the hash (for login) and the encrypted email (for server-initiated
communication).

### Why not E2E encrypt the email?

The server needs to read the email to send messages. E2E encryption would
require the client to be online to decrypt, defeating the purpose of
server-initiated communication (password reset emails, security alerts).

### Why not plaintext?

Defense-in-depth. The encryption key is held in environment variables, separate
from database credentials. A database breach alone does not expose email
addresses. This follows the same principle as SQLCipher for local SQLite (ADR 018) -- the encryption is not a zero-knowledge guarantee, but a meaningful
barrier against partial compromises.

### Key management

The `EMAIL_ENCRYPTION_KEY` is a 64-character hex string (32 bytes). It must be:

- Generated once and stored securely (e.g., in a secrets manager)
- Backed up -- losing it renders all encrypted emails unrecoverable
- Rotated by re-encrypting all rows (a future migration concern, not in scope)

The key is optional in development (the column is nullable). In production,
the key is required for any email-sending functionality.

## Consequences

- Email addresses are protected at rest against database-only breaches.
- The server operator holds the decryption key and can read emails. This is an
  explicit, documented exception to the zero-knowledge model, consistent with
  push tokens (ADR 015) and infrastructure metadata (ADR 018).
- Accounts created before this feature have `encrypted_email = NULL`. The
  `resolveAccountEmail` function returns `null` for these accounts gracefully.
- Future key rotation requires a batch migration to re-encrypt all rows.
