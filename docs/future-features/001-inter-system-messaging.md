# Future Feature: Inter-System Messaging

## Metadata

| Field                | Value                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| Status               | proposed                                                                          |
| Category             | communication                                                                     |
| Estimated Complexity | high                                                                              |
| Dependencies         | Privacy buckets (features.md Section 4), Friend network, E2E encryption (ADR 006) |
| Related Features     | features.md Section 5, features.md Section 4 (Privacy and Social)                 |

## Summary

Inter-system messaging enables direct communication between specific members of different systems. Rather than limiting external communication to system-level interactions, this feature allows individual members to send and receive messages through per-member external inboxes, all governed by privacy bucket rules.

Currently, the friend network allows systems to view each other's data (fronting status, member profiles, etc.) based on privacy bucket permissions, but there is no way for a friend to send messages back. Inter-system messaging closes this gap by adding bidirectional member-to-member communication across system boundaries.

## Motivation

Systems frequently form close relationships with other systems, and those relationships often exist between specific members rather than at the system level. A protector in one system may coordinate with a protector in another. Littles in different systems may be friends. Co-hosts across systems may need to communicate directly.

Without member-level messaging, systems are forced to use external platforms (Discord, Signal, etc.) where they lose the privacy controls, member identity context, and encryption guarantees that Pluralscape provides. By bringing inter-system messaging into the app, members can communicate with the same privacy and identity infrastructure they already use internally.

## User Stories

- As a member of a system, I want to send a direct message to a specific member of a friend's system so that I can communicate with them as myself rather than through a generic system account.
- As a member, I want my own external inbox so that messages from other systems are addressed to me specifically and I can read them on my own terms.
- As a system administrator, I want to control which members can receive external messages via privacy buckets so that I can protect members who should not be contacted (e.g., littles, trauma holders).
- As a member, I want to block incoming messages from a specific external member without affecting the broader friend connection so that I can manage my own boundaries.
- As a system, I want all inter-system messages to be end-to-end encrypted so that the server cannot read any message content.
- As a member receiving a message, I want to see the sender's member profile (as permitted by their privacy buckets) so that I know who I am talking to.

## Proposed Behavior

### Sending Messages

When viewing a friend's system, a member can navigate to a visible member's profile and initiate a direct message conversation. The sender selects which of their own members is sending the message. The message is composed in a simple text editor (rich text support matching internal chat) and encrypted before leaving the device.

### Per-Member Inboxes

Each member has their own external inbox, separate from internal system chat. The inbox displays conversations grouped by external member, with unread indicators. Members only see messages addressed to them -- they cannot read messages sent to other members in their system (unless the system has configured shared inbox access).

### Privacy Bucket Integration

Inter-system messaging respects privacy buckets at multiple levels:

- **Contactability**: A member can only be messaged by an external system if their member profile is visible to that system's assigned privacy bucket. Members hidden from a friend cannot be messaged by that friend's members.
- **Message content**: Message content is encrypted with the shared bucket key for the relevant privacy bucket, ensuring only authorized recipients can decrypt it.
- **Per-friend visibility settings**: The existing `FriendVisibilitySettings` can include a toggle for whether messaging is allowed at all for a given friend connection.

### Notifications

When a message arrives, the notification routes to the specific recipient member. Systems with per-member notification settings can suppress notifications for specific members. The notification displays the sender's name and system (if permitted by the sender's privacy buckets).

## Technical Considerations

### Message Routing

The server needs a message routing layer that maps `(sender_system, sender_member, recipient_system, recipient_member)` tuples. The server stores encrypted message blobs and delivers them, but cannot read content. Message metadata (sender system ID, recipient system ID, timestamp) is T3 plaintext for routing purposes. Sender and recipient member IDs within the message are T2 encrypted per-bucket -- the server knows which systems are communicating but not which specific members.

### Cross-System E2E Encryption

Internal system chat uses the system's own encryption keys. Cross-system messaging requires a key exchange mechanism between systems. Options include:

- **Double ratchet protocol**: Provides forward secrecy and break-in recovery, similar to Signal protocol. Each member-to-member conversation maintains its own ratchet state.
- **Shared bucket key approach**: Reuse the existing privacy bucket key infrastructure. Messages are encrypted with the bucket key that governs the friend connection. Simpler but lacks per-conversation forward secrecy.
- **Hybrid**: Use bucket keys for initial key exchange, then establish per-conversation ratchets for forward secrecy.

The chosen approach must handle the case where multiple devices are logged in and need to decrypt incoming messages.

### Data Model

New entities needed:

- `ExternalConversation` -- links two members across two systems, stores ratchet state
- `ExternalMessage` -- encrypted message blob, timestamps, delivery status
- `ExternalInbox` -- per-member inbox metadata, unread counts
- `MessageBlock` -- per-member or per-system block list for external contacts

### Notification Routing

Push notifications for external messages must route to the correct member. Since the server cannot read which member is the recipient (member ID is encrypted), the client must register notification channels per member or the server must have a T3 routing hint.

### Offline Support

Messages sent while the recipient is offline must be queued server-side and delivered on next sync. The CRDT sync protocol (Automerge) may need extension to handle external message streams, or external messages could use a separate delivery channel outside the CRDT sync.

## Privacy and Encryption Implications

Privacy is the central challenge of this feature. The design must uphold Pluralscape's zero-knowledge server model while enabling cross-system communication.

- **Message content is T1 (zero-knowledge)**: The server stores ciphertext only. Message bodies, attachments, and member-level routing information are encrypted client-side.
- **Routing metadata is T3 (server-visible)**: The server must know which system to deliver a message to, so system-level routing is plaintext. Timestamps are also T3 for notification triggers.
- **Member identity within messages is T2 (encrypted per-bucket)**: Which specific member sent or received a message is encrypted with the shared bucket key. The server routes to a system, and the client decrypts to determine the specific member.
- **Cross-system key exchange**: Establishing shared encryption keys between two systems that have never communicated before is non-trivial. The friend connection handshake (friend codes) could be extended to include key material exchange.
- **Fail-closed**: If any part of the encryption or routing fails, the message is not delivered. No fallback to plaintext. No silent degradation.
- **Revocation**: When a friend connection is severed, all shared keys must be rotated and outstanding messages must become undeliverable.

## Open Questions

- What should the message retention policy be? Should messages auto-delete after a configurable period, or persist indefinitely like internal chat?
- Should group messaging across systems be supported (e.g., a group chat with members from 3 different systems)? This significantly increases key management complexity.
- Should read receipts be supported? They leak information about when a specific member is active. If supported, they should be opt-in per member.
- How should message delivery work for systems with many members -- does every member get notified of every incoming message, or only the addressed recipient?
- Should there be rate limiting on external messages to prevent harassment, separate from API rate limits?
- How does this interact with the block/report infrastructure? Can a member block an individual external member without blocking the entire system?
- Should message history be included in data exports? If so, both sides of the conversation need to be considered for GDPR deletion requests.
