# Future Feature: Official Client SDKs

## Metadata

| Field                | Value                                                           |
| -------------------- | --------------------------------------------------------------- |
| Status               | proposed                                                        |
| Category             | integration                                                     |
| Estimated Complexity | high                                                            |
| Dependencies         | Public REST API (ADR 013), Stable encryption protocol (ADR 006) |
| Related Features     | features.md Section 9 (API and Integrations)                    |

## Summary

Official client SDKs for common programming languages that handle authentication, API interaction, and libsodium decryption out of the box. These libraries abstract the complexity of Pluralscape's crypto stack so that third-party developers can build integrations without implementing XChaCha20-Poly1305 decryption, Argon2id key derivation, or privacy bucket key management from scratch.

The SDK lineup targets Python, JavaScript/TypeScript, Go, Rust, and C# -- covering the most common languages used by the plural community's developer base and the broader integration ecosystem (Discord bots, web dashboards, mobile apps, game mods, etc.).

## Motivation

Pluralscape's public REST API (ADR 013) supports two key types: metadata keys (T3 plaintext data only, no crypto needed) and crypto keys (carry encrypted key material for T1/T2 data access). Metadata keys are simple to use -- any HTTP client can call the API and get JSON back. But crypto keys require the caller to implement the full decryption pipeline: extract the key material from the API key, derive the correct decryption key, identify the encryption algorithm and nonce, and decrypt the ciphertext.

This is a significant barrier. Even experienced developers may implement the crypto stack incorrectly, leading to silent data corruption, key leakage, or inability to decrypt data. The integration guides (features.md Section 9) help, but a guide is not a substitute for a tested, maintained library.

Official SDKs reduce this barrier to a few lines of code:

```
client = Pluralscape(api_key="ps_crypto_...")
members = client.members.list()  # automatically decrypted
```

By providing SDKs, we expand the ecosystem of third-party tools, encourage community innovation, and ensure that integrations handle encryption correctly rather than rolling their own (potentially insecure) implementations.

## Proposed Behavior

### SDK Architecture

Each SDK follows the same conceptual architecture, adapted to the idioms of its target language:

**Client Initialization**: The developer creates a client instance with their API key. The SDK detects whether the key is a metadata key or a crypto key and configures itself accordingly. Crypto keys trigger automatic key material extraction and decryption pipeline setup.

**Resource Methods**: The SDK exposes methods for each API resource (members, fronting sessions, groups, notes, etc.) with CRUD operations. For crypto-key clients, responses are automatically decrypted before being returned. For metadata-key clients, only T3 fields are available and T1/T2 fields return `null` or are omitted.

**Pagination**: List endpoints return paginated iterators that automatically fetch subsequent pages. The developer can iterate without managing cursors or page tokens.

**Rate Limiting**: The SDK reads rate limit headers from API responses and automatically backs off when limits are approached. Configurable retry policies with exponential backoff and jitter.

**Error Handling**: API errors are mapped to language-idiomatic exceptions/errors with structured information (error code, message, retry-after).

**Type Safety**: SDKs for typed languages (TypeScript, Go, Rust, C#) provide full type definitions for all API resources. Python SDK provides type hints compatible with mypy/pyright.

### Language-Specific Details

**Python**: Published on PyPI. Uses `httpx` for HTTP, `PyNaCl` (libsodium binding) for crypto. Supports both sync and async usage. Python 3.9+.

**JavaScript/TypeScript**: Published on npm. Uses `fetch` (or `node-fetch` for older Node versions) for HTTP, `libsodium-wrappers-sumo` for crypto. Works in Node.js, Deno, and Bun. Full TypeScript type definitions. ESM and CJS dual-publish.

**Go**: Published as a Go module. Uses `net/http` for HTTP, `golang.org/x/crypto/nacl` or a libsodium CGo binding for crypto. Idiomatic Go error handling (no exceptions). Go 1.21+.

**Rust**: Published on crates.io. Uses `reqwest` for HTTP, `sodiumoxide` or `libsodium-sys` for crypto. Async by default (tokio). Full type safety with serde deserialization. Strong error types with `thiserror`.

**C#**: Published on NuGet. Uses `HttpClient` for HTTP, `Sodium.Core` (libsodium-net) for crypto. Targets .NET 6+. Async/await throughout. Used by Unity game developers for in-game integrations.

### Versioning

SDK versions are decoupled from API versions. Each SDK specifies which API version(s) it supports. When the API adds new endpoints or fields, the SDK releases a minor version update. Breaking API changes (rare, with long deprecation periods) trigger a major SDK version bump.

SDKs include an `api_version` parameter on the client to pin a specific API version, preventing unexpected breaking changes.

## Technical Considerations

### Crypto Implementation

The SDKs must correctly implement the full Pluralscape encryption protocol:

1. **Key extraction**: Parse the crypto key to extract the encrypted key material blob.
2. **Key derivation**: Use Argon2id to derive the decryption key from the key material (parameters must match the server's configuration exactly).
3. **Decryption**: Use XChaCha20-Poly1305 to decrypt response ciphertext. Handle nonce extraction, authentication tag verification, and plaintext reconstruction.
4. **Bucket key management**: For T2 data, the SDK must identify the correct privacy bucket key, decrypt it, and use it to decrypt the per-bucket ciphertext.
5. **Key caching**: Derived keys should be cached in memory for the lifetime of the client instance to avoid repeated Argon2id derivations (which are intentionally expensive).
6. **Secure memory**: Where the language supports it (Rust, Go, C), key material should be stored in secure/non-swappable memory and zeroed on client destruction.

### Auto-Generation vs Hand-Written

Two approaches for SDK creation:

- **Auto-generated from OpenAPI spec**: Tools like `openapi-generator` can produce client libraries from the API's OpenAPI specification. This ensures completeness and reduces maintenance burden when endpoints change. However, auto-generated code often has poor ergonomics, and the crypto layer cannot be auto-generated.
- **Hand-written with generated types**: Write the SDK core (client, auth, crypto, pagination, error handling) by hand for each language, but generate the resource type definitions from the OpenAPI spec. This gives the best ergonomics while reducing the maintenance burden of keeping types in sync.

The recommended approach is hand-written SDKs with generated types. The crypto layer is too critical and language-specific to auto-generate, and SDK ergonomics directly impact developer adoption.

### Testing

Each SDK needs:

- **Unit tests**: Mock HTTP responses, verify correct decryption of test vectors, validate error handling.
- **Integration tests**: Run against a test instance of the Pluralscape API with known test data and encryption keys.
- **Crypto test vectors**: A shared set of test vectors (plaintext, key, nonce, ciphertext) that all SDKs must pass. This ensures cross-SDK compatibility and correctness.
- **CI/CD**: Automated testing on each commit, with release pipelines for publishing to package registries (PyPI, npm, crates.io, etc.).

### Documentation

Each SDK includes:

- README with quickstart guide
- API reference documentation (auto-generated from docstrings/comments)
- Code examples for common use cases (list members, get current fronter, listen for switches via webhooks)
- Migration guides for major version bumps

## Privacy and Encryption Implications

Client SDKs are a critical security surface. An SDK that incorrectly implements the crypto stack could leak decrypted data, expose key material, or silently produce incorrect decryptions.

- **SDKs must correctly implement the full crypto protocol**: This is non-negotiable. Each SDK must pass the shared crypto test vector suite before release. A single incorrect implementation could compromise user data for every integration using that SDK.
- **Key material handling**: SDKs must never log, serialize, or persist key material to disk. Keys exist only in memory for the lifetime of the client instance. Crypto keys should be treated as secrets equivalent to passwords.
- **Decrypted data handling**: SDKs return decrypted data to the caller, who is then responsible for handling it securely. SDK documentation must clearly state that decrypted data is sensitive and should not be logged, cached to disk, or transmitted over insecure channels.
- **Transport security**: All SDK HTTP calls must use TLS 1.2+ with certificate verification enabled. The SDK must not provide a "disable TLS verification" option, even for development. (A separate localhost-only mode with self-signed cert support may be offered for self-hosted development instances.)
- **Security review**: Each SDK must undergo a security review before initial release. The review should cover: correct libsodium usage, key material lifecycle, memory safety (for unsafe languages), dependency audit, and resistance to timing attacks on authentication.
- **Vulnerability disclosure**: SDKs must have a clear vulnerability disclosure process. Security issues in SDKs are as critical as issues in the server itself.
- **Third-party dependencies**: Each SDK introduces a dependency on a libsodium binding for its target language. These bindings must be actively maintained, widely used, and audited. Prefer bindings that wrap the canonical libsodium C library rather than pure-language reimplementations.

## Open Questions

- Which languages should be prioritized for the initial release? Python and JavaScript/TypeScript likely have the highest demand (Discord bots, web dashboards), but Rust and Go may attract security-conscious developers who value the crypto guarantees.
- Should SDKs be auto-generated from the OpenAPI spec (lower maintenance, worse ergonomics) or hand-written (better ergonomics, higher maintenance)? A hybrid approach (hand-written core with generated types) may be optimal.
- How should SDK versioning relate to API versioning? Should the SDK major version track the API major version, or should they be independent?
- Should the SDKs include webhook payload verification helpers (validating webhook signatures) in addition to REST API clients?
- How should the SDKs handle the case where a crypto key's scoping does not include the requested resource? Should the SDK raise an error, return null fields, or silently omit encrypted data?
- Should the SDKs provide a "streaming" mode for real-time data (WebSocket/SSE) in addition to REST, or should real-time integrations use webhooks exclusively?
- What is the maintenance commitment for each SDK? Each additional language is an ongoing maintenance burden. Should community maintainers be accepted for less-popular languages, with the core team maintaining only Python and TypeScript?
