# ADR 015: Push tokens stored as plaintext

## Status

Accepted

## Context

Push notification tokens (APNs device tokens, FCM registration tokens) must be
transmitted to Apple and Google servers verbatim to deliver notifications. The
server cannot relay an encrypted token — the upstream provider requires the
exact token bytes it issued. Encrypting device tokens with the system master key
would render them useless for their only purpose.

Push tokens are semi-sensitive infrastructure credentials (knowledge of a token
allows sending notifications to a device) but they are not user content. The
zero-knowledge threat model targets user data — journals, member profiles,
messages — not infrastructure tokens. The server already holds session keys and
other metadata that fall outside the ZK boundary.

## Decision

DeviceToken rows store `token`, `platform`, and `lastActiveAt` as T3 plaintext
columns with no client-side encryption. The tier map in `encryption.ts`
documents this explicitly.

## Consequences

- Push notifications work correctly: the server can read and forward tokens.
- Tokens are visible to the server and any operator with DB access. This is a
  deliberate, documented exception to the zero-knowledge model.
- If the threat model changes to require token privacy, a server-side proxy
  (e.g., a blind relay that never persists tokens) would be the appropriate
  architecture change; it cannot be solved by encrypting the column.
