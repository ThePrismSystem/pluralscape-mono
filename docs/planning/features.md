# Feature Specification

Actionable feature spec for Pluralscape, organized by domain.

## 1. Identity Management

- **Member profiles** — name, pronouns, description, avatar, color, creation date
  - Description supports rich linking to other members, groups, and system structure entities
  - Touching a link shows a preview card with option to navigate to that entity
  - Multiple colors per member (for theming)
  - Multi-photo gallery per member (swipeable, not just a single avatar)
  - Completeness level: fragment (minimal data, nullable fields), demi-member, or full member
  - Role tags (protector, gatekeeper, caretaker, little, age-slider, trauma holder, etc.)
- **Image editing** — built-in crop and resize when uploading avatars or gallery photos (no external tool needed)
- **Custom fields** — unlimited user-defined fields per member
- **Group membership display** — member profiles show all groups they belong to, with links to view each group
- **System structure membership display** — optional setting to show which subsystems/side systems a member belongs to on their profile, with links to those entities
- **Groups/folders** — hierarchical organization with multi-group membership, drag-and-drop reorder
  - Groups have: image, description, color, emoji
  - Move/copy entire folders between other folders
- **Archival** — non-destructive, read-only preservation with instant restore
- **Custom fronts** — abstract cognitive states logged like members (e.g., "Dissociated", "Blurry")

## 2. Fronting and Analytics

- **Front logging** — single-tap switch, co-fronting as parallel timelines (not mutually exclusive)
  - Reliable offline-to-online transition
  - Non-compulsive UX: supports flexible/retroactive logging so users don't feel obligated to log immediately
  - Co-fronting vs co-conscious distinction (active control vs passive awareness)
  - Custom front status text per fronting session (max 50 chars, matches SP behavior)
  - Subsystem-level fronting (subsystems can front independently of the parent system)
- **Historical editing** — retroactive entries, timestamp adjustment, comments on entries
- **Timeline visualization** — multi-lane display, color-coded per member, co-fronting overlap visible
- **Analytics** — cumulative duration, average session length, pie/bar charts, date range filters
- **Fronting history report** — exportable report (HTML or PDF) of fronting data with date range filters; generated client-side (server cannot read encrypted data)
- **Automated timers / dissociation check-ins** — configurable intervals, waking hours only

## 3. Communication

- **System chat** — proxy messaging, channels/categories, rich text, @mentions, rapid proxy switching
- **Board messages** — persistent noticeboard, drag-and-drop reorder, immune to chat scroll
- **Private notes** — member-bound or system-wide, rich text, custom background colors
- **Polls** — multiple choice, one vote per member, consensus analytics
- **Mandatory acknowledgement routing** — targeted alerts that persist until a specific member confirms

Note: polls and acknowledgements are cooperative guardrails within a system, not cryptographically enforced. Members share one account — the app facilitates trust-based internal coordination, not identity verification.

## 4. Privacy and Social

- **Privacy buckets** — intersection-based tagging with fail-closed defaults (ADR 006)
  - Unmapped or errored privacy data defaults to maximum restriction (invisible to all)
  - Controls visibility at multiple levels: members, custom fields, fronting status, etc.
  - Custom field visibility is per-bucket, applied globally across all members (not per-member granularity)
- **Friend network** — friend codes, read-only external dashboard
- **Friend visibility** — friends can view based on their assigned privacy buckets:
  - Active fronters (including custom fronts and custom front status)
  - Member list and member profiles
  - Custom fields (controlled per-bucket — e.g., one friend sees a custom field, another does not)
  - Search within visible data (friend's client pulls bucket-permitted data locally for search)
- **Push notifications** — configurable switch alerts to friends

## 5. Inter-System Messaging (future)

Tracked as a potential future feature; may be deferred past initial launch.

- **External DMs** — between specific members of different systems
- **Per-member external inboxes** — each member has their own inbox for cross-system messages
- **Privacy-controlled** — subject to privacy bucket rules

## 6. System Structure

Nomenclature option: "Structure" / "Topology" / "Map" / custom

- **Relationship data model** — member-to-member connections with typed, directed edges
  - Relationship types: split-from, fused-from, sibling, partner, parent-child, protector-of, caretaker-of, gatekeeper-of, source (for introjects), and custom user-defined types
  - Bidirectional flag per relationship (e.g., "sibling" is mutual, "protector-of" is directional)
- **Multiple structure types** for complex/polyfragmented systems:
  - Recursive tree model (no hard depth limit) — subsystems within subsystems within subsystems
  - Side systems (parallel groups, not nested inside a member)
  - Layers (vertically stacked divisions with differing access rules, optionally gatekept)
  - Subsystem metadata: architecture type (orbital, compartmentalized, webbed, mixed), origin type, has-core flag, discovery status (fully mapped vs still discovering)
  - Members belong to any level of nested structure
  - Subsystems/side systems can front independently (replaces SP workaround of custom fronts for "someone in subsystem X is fronting")
- **Member lifecycle events** — append-only log tracking:
  - Split (one member divides into multiple)
  - Fusion (permanent combination into a new member)
  - Merge (temporary blurring between members) and unmerge
  - Dormancy start/end
  - Discovery and archival
  - Each event links the involved members and resulting members
- **Innerworld mapping** — spatial positioning on 2D canvas
  - Layers/regions with access rules (open vs gatekept)
  - Gatekeeper member assignment per region
- **Visual structure editor** — pan/zoom canvas, drag-and-drop, connecting lines
  - Data model and relationship management UI are day-one requirements
  - Visual canvas is stretch goal but targeted for day-one

## 7. Journaling

- **Block-based rich-text editor** — nested, structured content blocks
- **Hyperlinked pages** — member names auto-link to profiles
- **Internal wiki** — system lore, term definitions, trauma timelines
- Replaces basic Notes for power users (Notes remain for simple use)

## 8. Search

Full-text search across all entity types, powered by local SQLite FTS5. Search runs client-side against decrypted data (server cannot search encrypted content).

- **Searchable entities:** members, custom fields, groups, notes, journal entries, chat messages, board messages, system structure entities
- **Search when viewing a friend's system:** friend's client pulls all bucket-permitted data locally, enabling search within the friend's visible data
- **Search UX:** global search bar with entity-type filters, result previews with navigation

## 9. API and Integrations

- **Public REST API** — 17+ endpoint categories (ADR 003)
  - API uses canonical terms (`member`, `system`, `fronting`, `switch`) regardless of per-system nomenclature settings
  - Hybrid auth model with two key types (ADR 013):
    - **Metadata keys** — access tier 3 plaintext data only (timestamps, events, connection status). No crypto needed. For simple integrations like Discord bots.
    - **Crypto keys** — carry encrypted key material, enabling decryption of tier 1/2 data. User-controlled scoping (full access, specific buckets, fronting only, etc.). Created from an authenticated client session.
  - Key creation UI uses plain language, visual scope indicators, and confirmation prompts for high-access keys
- **Custom webhooks** — user-configurable, triggered on events (switches, messages, member changes, etc.)
  - Default: tier 3 metadata payloads (no crypto needed to consume)
  - Optional: encrypted tier 1/2 payloads for webhook endpoints with an assigned crypto key
- **PluralKit bridge** — bidirectional sync via PK token; runs client-side (requires app to be open) since the server cannot decrypt data
- **Rate limiting** — intelligent backoff
- **API documentation** — auto-generated from endpoint definitions
- **Integration guides** — step-by-step guides for common languages (Python, JavaScript/TypeScript, Go, Rust, C#) covering authentication, metadata endpoints, and encrypted data decryption
- **Client SDKs** (future) — official libraries for common languages that handle authentication and libsodium decryption, so third-party developers don't need to implement the crypto stack themselves

## 10. Data Portability

All report generation is client-side (the server cannot read encrypted data).

- **Simply Plural import** — parse SP JSON export (raw MongoDB dump, no schema version): members, fronting history, custom fields, groups, notes, chat messages (decrypted), board messages, polls, timers, privacy buckets, friend data. Avatars imported separately (ZIP with 7-day expiry). IDs are MongoDB ObjectIds; timestamps are epoch milliseconds. Import runs client-side with progress indicator; large imports are chunked to avoid OOM on low-spec devices.
- **PluralKit import** — parse PK JSON export (schema version 2): members, switches, groups. Uses 5-char human-readable IDs; timestamps are ISO 8601. Note: PK has no custom fields, notes, polls, chat, timers, or privacy buckets.
- **JSON/CSV export** — all user data, single-click
- **Member report** — generated based on a chosen privacy bucket; includes all member data visible within that bucket, formatted for readability even with hundreds of members (HTML or PDF, potentially many pages)
- **"Meet our system" report** — simplified, shareable overview for friends/family with user-chosen content (HTML or PDF)
- **Data deletion** — full account purge, GDPR-compliant

## 11. Internationalization (i18n)

- All UI strings externalized from day one
- Translation framework integrated into build pipeline
- RTL language support
- Date/time/number localization
- Community translations via Crowdin

## 12. Configurable Nomenclature

Nomenclature is a **UI display-layer concern only**. The API, database schema, and internal code always use canonical terms (`member`, `system`, `fronting`, `switch`, etc.). The client applies the user's configured terminology at render time.

- User-facing terminology is configurable in settings
- Initial setup wizard prompts for nomenclature preferences on first use
- Configurable terms with defaults and community alternatives:
  - **Collective**: "System" / "Collective" / "Household" / "Crew" / "Group" / custom
  - **Individual**: "Member" / "Alter" / "Headmate" / "Part" / "Insider" / custom (median systems may prefer "Facet" / "Aspect")
  - **Fronting**: "Fronting" / "In front" / "Driving" / "Piloting" / custom
  - **Switching**: "Switch" / "Shift" / custom
  - **Co-presence**: "Co-fronting" / "Co-conscious" / "Co-driving" / custom
  - **Internal space**: "Headspace" / "Innerworld" / "Wonderland" / custom
  - **Primary fronter**: "Host" / "Primary fronter" / "Main fronter" / custom (sensitive — "host" implies hierarchy)
  - **Structure**: "System Structure" / "Topology" / "Map" / custom
- Stored per-system (each system chooses their own terms)

## 13. Accessibility and UX

- WCAG compliance (screen readers, semantic markup)
- Dark mode / high-contrast mode
- Dynamic typography (global font scaling without layout breakage)
- Touch targets 44x44pt minimum
- Color never sole information carrier
- **Littles Safe Mode** — simplified UI: large buttons, icon-driven, no deletion, no settings, no analytics
  - Configurable safe content: ability to add links, YouTube videos, and other media for display in safe mode

## 14. Security and Encryption

### Encryption tiers

Data is categorized into three tiers based on sensitivity and server visibility:

- **Tier 1 — Encrypted (zero-knowledge):** Member profiles, custom fields, notes, chat messages, journal entries, fronting comments, innerworld data, photos/media. Server stores ciphertext only and cannot read, search, or index this data.
- **Tier 2 — Encrypted per-bucket (server routes, cannot read):** Data shared with friends via privacy buckets. Server knows which bucket a blob belongs to (for routing) but cannot read the contents. Friends decrypt with the shared bucket key.
- **Tier 3 — Plaintext metadata (server-visible):** Account info, friend connection graph, bucket membership (who has access to which bucket), fronting session timestamps (start/end — needed for push notification triggers), webhook delivery metadata, API rate limiting state.

### Encryption primitives

- libsodium: XChaCha20-Poly1305 (symmetric), X25519 (key exchange), Argon2id (key derivation) — ADR 006
- Per-bucket symmetric keys for privacy bucket sharing
- Client-side encryption/decryption for all tier 1 and tier 2 data

### Key recovery (ADR 011)

- **Recovery key** — generated at registration, user stores offline (printed or saved). Can re-derive encryption master key.
- **Multi-device recovery** — if another device is logged in, new device receives keys via encrypted device-to-device transfer.
- **No social recovery** for v1 (complexity and trust concerns).
- **Password reset without recovery key = new account with data loss.** UI must make this extremely clear during onboarding.

### Other security features

- **PIN code / biometric lock** — app foreground trigger
- **Security audit log** — login timestamps, IP addresses, failed attempts, data exports
- **Fail-closed privacy** — errors/unmapped data default to maximum restriction

## 15. Offline-First and Sync

- Local SQLite as source of truth (ADR 005)
- CRDT-based sync via Automerge — confirmed only after cryptographic handshake (ADR 005)
- Sync protocol co-designed with database schema (not retrofitted)
- Visual sync indicator (spinning icon during transfer)
- Queue-based offline writes persisted and replayed on reconnect

## 16. Media Storage

Encrypted blob storage for avatars, photo galleries, import archives, and littles safe mode media. ADR 009.

- **S3-compatible object storage** — MinIO for self-hosted, any S3 provider for hosted service
- **Client-side encryption** — all media encrypted before upload, decrypted after download
- **Client-side thumbnailing** — thumbnails generated on-device and uploaded as separate encrypted blobs
- **Self-hosted fallback** — local filesystem storage when no S3 is configured (minimal tier)
- **Image editing** — built-in crop/resize before upload (no external tool required)

## 17. Background Jobs

Async processing for long-running and retryable tasks. ADR 010.

- **BullMQ** (Valkey-backed) for hosted service — retry with exponential backoff, dead-letter queue, idempotency keys
- **SQLite-backed in-process queue** for self-hosted minimal tier (single-worker fallback)
- **Job types:** SP/PK imports, report generation, webhook delivery/retry, push notification fan-out, account purge, bucket key rotation

## 18. Self-Hosted Deployment

Two deployment tiers. ADR 012.

### Minimal (single binary)

- Bun-compiled single binary (ADR 008)
- SQLite backend (no PostgreSQL dependency)
- Local filesystem for blob storage
- In-process job queue (SQLite-backed, single-worker)
- No real-time (polling only — no Valkey, no WebSockets)
- No push notifications
- Setup wizard (first-run configuration)
- Suitable for personal or small-group use

### Full (Docker Compose)

- PostgreSQL + Valkey + S3/MinIO
- WebSocket support, SSE, push notifications
- BullMQ job queue with full retry/DLQ
- Feature parity with hosted service
- Docker Compose file with all services preconfigured

## 19. Widget and Wearable Support (future)

Tracked as a potential future feature; may be deferred past initial launch.

- Home screen widgets (quick front switching, current fronter display)
- Apple Watch companion (front switching, current fronter glance)

## 20. Monetization (post-launch)

Cosmetic only — revenue covers server costs exclusively. No functional features paywalled, ever.

- Premium themes (gradient customization)
- Avatar frame assembler (geometric shapes, borders, backgrounds)
- Supporter badge on friend network
