# ADR 013: API Authentication with E2E Encryption — Hybrid Token Model

## Status

Accepted

## Context

Pluralscape's public REST API must coexist with E2E encryption (ADR 006). The server is zero-knowledge — it stores ciphertext only. This creates a fundamental tension: standard API tokens prove identity to the server but cannot decrypt data.

The API must support:

- Simple integrations (Discord bots, webhooks) that only need event metadata
- Power-user integrations (custom dashboards, backup tools) that need full decrypted data
- User-controlled scoping — users decide what each key can access
- Instant revocation when a key is compromised
- Intuitive key creation UX that explains the security model in plain language

Evaluated: ciphertext-only API (clients implement full crypto), API keys with embedded key material, hybrid metadata + crypto keys.

## Decision

**Hybrid token model** with two key types: metadata keys and crypto keys.

### Key type 1: Metadata keys (tier 3 only)

Standard auth tokens that access plaintext metadata endpoints only. No cryptographic capability.

- **What they can access:** fronting session timestamps (start/end), friend connection status, webhook delivery status, rate limit state, account info, event streams
- **What they cannot access:** member names, profiles, custom fields, chat messages, notes — anything encrypted (tier 1 or tier 2)
- **Use case:** Discord bots ("someone switched"), monitoring dashboards, simple webhook consumers
- **Creation:** generated server-side, no crypto involved, standard bearer token

### Key type 2: Crypto keys (tier 1/2/3)

API keys that carry encrypted key material, enabling decryption of user data.

- **Creation flow** (from an authenticated client session):
  1. User selects a scope (which data the key can access)
  2. Client generates a random API secret
  3. Client encrypts the relevant keys (MasterKey for full access, or specific bucket keys for scoped access) using a key derived from the API secret
  4. Encrypted key bundle stored on the server, associated with the token ID
  5. User receives the full API key (token ID + secret) — displayed once, never recoverable

- **Scoping options:**
  - "Full access" — includes MasterKey, can decrypt everything
  - "Specific privacy buckets" — includes only selected bucket keys
  - "Fronting data only" — includes only keys needed for fronting records
  - Custom combinations

- **On API request:** client authenticates with token ID → server returns encrypted key bundle + encrypted data → API consumer derives decryption key from secret → decrypts key bundle → decrypts data

- **Use case:** backup tools, custom dashboards, PluralKit bridge, full-featured third-party apps

### Revocation

- Metadata keys: server deletes the token, immediate effect
- Crypto keys: server deletes the token AND the encrypted key bundle. The API secret alone cannot access anything without the server-stored bundle. Immediate effect.

### Webhook payloads

- Default: tier 3 metadata only (event type, timestamps, IDs). No crypto needed to consume.
- Optional: user can configure a webhook to include encrypted tier 1/2 data. The webhook endpoint must have the corresponding crypto key to decrypt. The user assigns a crypto key to the webhook during configuration.

### Key creation UX principles

The UI must be approachable for non-technical users:

- **Plain-language scope descriptions:** "This key can see who is fronting and when, but cannot read member profiles or messages" vs "This key can read everything, including private notes and chat"
- **Visual indicators:** color-coded badges (green = metadata only, orange = partial access, red = full access)
- **Confirmation for high-access keys:** creating a full-access crypto key requires explicit acknowledgment ("This key can read all your data. Anyone with this key has the same access as you.")
- **Key lifecycle dashboard:** list all active keys, last used timestamp, scope summary, one-click revoke
- **No jargon in the UI:** "encryption key" → "data access key", "tier 3 metadata" → "activity info (times and events only)", "MasterKey" → avoid entirely in UI

## Consequences

- Two key types add complexity to the API documentation — must be clearly distinguished
- Crypto keys are high-value secrets — if leaked, attacker can decrypt scoped data until revoked. The UI must communicate this clearly.
- Crypto key creation only works from an authenticated client (needs the MasterKey to encrypt the key bundle). Cannot be done from the API itself.
- API consumers using crypto keys must implement libsodium decryption — mitigated by providing client SDKs (future) and integration guides for common languages
- Webhook payload encryption is optional — most integrations will use plaintext metadata payloads, reducing complexity for simple use cases
- Scoping adds granularity but also UX complexity — the scope selection UI must be simple with sensible presets, not a raw permission matrix

### License

No new dependencies. Uses existing libsodium primitives (ADR 006).
