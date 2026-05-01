# Mobile Developer Guide

This guide covers the Pluralscape mobile app (`apps/mobile/`), built with Expo (SDK 55) and React Native, with `expo-router` for file-based routing. It serves two audiences: contributors working on the mobile codebase, and API consumers or self-hosters who want to understand how the client operates.

For overall system architecture, see [`../architecture.md`](../architecture.md). For the sync protocol, see [`sync-protocol.md`](sync-protocol.md).

---

## Part 1 -- Architecture

### Routing

The app uses [Expo Router](https://expo.dev/router) with file-based routing. Route groups:

- `(auth)/` -- unauthenticated screens: `login`, `register`
- `(app)/(tabs)/` -- authenticated tabbed screens (main app surface)

`AuthGate` in the root layout redirects to `/(auth)/login` when the auth state is `unauthenticated` and shows a lock screen when `locked`. Authenticated users reach `(app)/(tabs)/`.

### Provider Tree

The root layout (`app/_layout.tsx`) wraps the app in a provider tree. Initialization order (outermost to innermost):

| Provider                | Purpose                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **PlatformProvider**    | Detects runtime (iOS/Android/web), resolves storage drivers and crypto adapter       |
| **I18nProvider**        | Locale detection, RTL layout, translation resources                                  |
| **QueryClientProvider** | React Query cache shared by tRPC and local queries                                   |
| **TRPCProvider**        | tRPC client with batched HTTP link, SSE subscription link, auth headers              |
| **RestClientProvider**  | REST API client for endpoints not covered by tRPC (blob uploads, webhooks)           |
| **AuthProvider**        | Auth state machine (login/logout/lock/unlock), token persistence                     |
| **AuthBridgeProviders** | Extracts credentials from auth snapshot and distributes them:                        |
| SystemProvider          | Active `systemId` from auth credentials                                              |
| CryptoProvider          | `masterKey` (KDF-derived, available only when unlocked)                              |
| BucketKeyProvider       | Decrypted bucket keys for friend visibility (from key grants, requires `boxKeypair`) |
| **DataLayerProvider**   | Local SQLite database, event bus, query invalidator                                  |
| **ConnectionProvider**  | SSE connection state machine, auto-connects on unlock                                |
| **SyncProvider**        | Sync engine lifecycle: WebSocket manager, key resolver, CRDT bootstrap               |
| **BootstrapGate**       | Blocks rendering until offline data is ready (or falls back to remote)               |
| **AuthGate**            | Redirects unauthenticated users to login, shows lock screen when locked              |

### Offline-First Model

Local SQLite is the source of truth once sync has bootstrapped. The dual-observer pattern drives every data hook:

1. Each hook registers two query observers: one local (SQLite), one remote (tRPC).
2. `useQuerySource()` determines which observer is active based on platform storage backend and sync bootstrap state.
3. When offline (or before bootstrap), local SQLite queries serve reads. When the sync engine has not yet bootstrapped and no SQLite driver is available, tRPC serves reads directly.
4. Writes always go through tRPC mutations. The sync engine propagates changes back to local SQLite via CRDT documents.

```
                          useQuerySource()
                          /            \
                     "local"          "remote"
                        |                |
              useQuery(SQLite)    trpc.*.useQuery()
                        |                |
                  rowTransform      select(decrypt)
                        |                |
                        +--- DataQuery --+
```

When the source is `"local"`, real-time updates flow through the sync engine to the event bus to the `QueryInvalidator`, which invalidates React Query cache entries by table name. When `"remote"`, standard tRPC cache behavior applies.

### Encryption on the Client

All sensitive data is encrypted at rest on the server. The client decrypts on read:

- **MasterKey** -- derived from the user's password via Argon2id. Available from `CryptoProvider` only when auth state is `unlocked`. Used to decrypt entity fields (member names, journal entries, etc.) via a `decrypt` callback in each hook.
- **Bucket keys** -- per-bucket symmetric keys (AEAD) for friend visibility. `BucketKeyProvider` fetches received key grants, decrypts them with the user's `boxKeypair` (X25519), and caches them. Used to decrypt data shared by friends.
- **Key zeroing** -- the `AuthStateMachine` fires `onKeyDiscard` when transitioning out of `unlocked`, calling `sodium.memzero()` on the master key. `BucketKeyProvider` zeros all cached keys on unmount.

---

## Part 2 -- Contributing to Mobile

### Hook Factory Pattern

Domain hooks follow a factory pattern defined in `apps/mobile/src/hooks/factories.ts`. Three factories handle the common patterns:

**`useOfflineFirstQuery`** -- single-entity get:

```ts
// Simplified from factories.ts
function useOfflineFirstQuery<TRaw, TDecrypted>(config: {
  queryKey: readonly unknown[]; // React Query cache key
  table: string; // SQLite table name
  entityId: string; // Primary key value
  rowTransform: (row: Record<string, unknown>) => TDecrypted;
  decrypt?: (raw: TRaw, masterKey: KdfMasterKey) => TDecrypted;
  useRemote: (args: UseRemoteGetArgs<TRaw, TDecrypted>) => DataQuery<TDecrypted>;
}): DataQuery<TDecrypted>;
```

When offline, executes `SELECT * FROM <table> WHERE id = ?` and applies `rowTransform`. When online, delegates to `useRemote` with an optional `select` callback that decrypts using the master key.

**`useOfflineFirstInfiniteQuery`** -- paginated list:

```ts
// Simplified from factories.ts
function useOfflineFirstInfiniteQuery<TRaw, TDecrypted>(config: {
  queryKey: readonly unknown[];
  table: string;
  rowTransform: (row: Record<string, unknown>) => TDecrypted;
  decrypt?: (raw: TRaw, masterKey: KdfMasterKey) => TDecrypted;
  includeArchived?: boolean;
  useRemote: (args: UseRemoteListArgs<TRaw, TDecrypted>) => DataListQuery<TDecrypted>;
}): DataListQuery<TDecrypted>;
```

Local mode paginates with `LIMIT/OFFSET` over SQLite. Archived entities are excluded by default (`AND archived = 0`). The system ID is auto-appended to the query key for cache isolation.

**`useDomainMutation`** -- mutations with cache invalidation:

```ts
// Simplified from factories.ts
function useDomainMutation<TData, TVars>(config: {
  useMutation: (opts: {
    onSuccess: (data: TData, vars: TVars) => void;
  }) => TRPCMutation<TData, TVars>;
  onInvalidate: (utils: AppUtils, systemId: SystemId, data: TData, vars: TVars) => void;
}): TRPCMutation<TData, TVars>;
```

Resolves the active system ID, grabs tRPC utils, and fires `onInvalidate` on mutation success for scoped cache invalidation.

### Writing a New Domain Hook

Use `apps/mobile/src/hooks/use-members.ts` as the reference implementation. Here is the pattern for a single-entity get hook:

```ts
// From use-members.ts
export function useMember(
  memberId: MemberId,
  opts?: SystemIdOverride,
): DataQuery<Member | Archived<Member>> {
  return useOfflineFirstQuery<MemberRaw, Member | Archived<Member>>({
    queryKey: ["members", memberId], // Convention: [tableName, entityId]
    table: "members", // SQLite table for local reads
    entityId: memberId, // Primary key for WHERE clause
    rowTransform: rowToMember, // SQLite row -> domain type
    decrypt: decryptMember, // Server DTO -> plaintext domain type
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.get.useQuery({ systemId, memberId }, { enabled, select }) as DataQuery<
        Member | Archived<Member>
      >,
  });
}
```

And the corresponding list hook:

```ts
// From use-members.ts
export function useMembersList(opts?: MemberListOpts): DataListQuery<Member | Archived<Member>> {
  return useOfflineFirstInfiniteQuery<MemberRaw, Member | Archived<Member>>({
    queryKey: ["members", "list", opts?.includeArchived ?? false],
    table: "members",
    rowTransform: rowToMember,
    decrypt: decryptMember,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.list.useInfiniteQuery(
        { systemId, limit: opts?.limit ?? DEFAULT_LIST_LIMIT /* ... */ },
        { enabled, getNextPageParam: (lastPage) => lastPage.nextCursor, select },
      ) as DataListQuery<Member | Archived<Member>>,
  });
}
```

Mutation hooks follow a consistent pattern -- wrap `trpc.*.useMutation` and invalidate related queries:

```ts
// From use-members.ts
export function useUpdateMember(): TRPCMutation<
  RouterOutput["member"]["update"],
  RouterInput["member"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.member.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.member.get.invalidate({ systemId, memberId: variables.memberId });
      void utils.member.list.invalidate({ systemId });
    },
  });
}
```

**Key conventions when adding a new domain:**

1. Query keys start with the table name: `["members", ...]`, `["groups", ...]`
2. Row transforms live in `apps/mobile/src/data/row-transforms/` grouped by domain
3. Decrypt functions live in `@pluralscape/data/transforms/` (shared with the API)
4. The `useRemote` callback is a thin wrapper around the tRPC hook -- the factory cannot call tRPC hooks directly because each entity has unique procedure types

### File size ceilings

ESLint enforces `max-lines: 500` on all files under `apps/mobile/src/**` (`tooling/eslint-config/loc-rules.js`). When a module hits the cap, split by concern -- do not add per-file overrides. The Simply Plural import persister is the canonical example: the original `apps/mobile/src/features/import-sp/trpc-persister-api.ts` was split (mobile-62f6) into focused modules under `apps/mobile/src/features/import-sp/trpc-persister-builders/` and the `persister/` subdirectory, with shared types in `trpc-persister-api.types.ts`. Test files follow the same split pattern (`__tests__/trpc-persister-api-{bulk,fronting,comms,core}.test.ts`).

### Platform Abstraction

The platform layer (`apps/mobile/src/platform/`) detects the runtime environment and provides appropriate drivers via `PlatformContext`:

**Capabilities** (`PlatformCapabilities`):

| Capability          | Native (iOS/Android)              | Web                                |
| ------------------- | --------------------------------- | ---------------------------------- |
| `hasSecureStorage`  | true                              | false                              |
| `hasBiometric`      | true                              | false                              |
| `hasBackgroundSync` | true                              | false                              |
| `hasNativeMemzero`  | true (if native module available) | false                              |
| `storageBackend`    | `"sqlite"`                        | `"sqlite"` (OPFS) or `"indexeddb"` |

**Storage drivers:**

- **Native**: `expo-sqlite` via `createExpoSqliteDriver()` -- full SQLite with WAL mode
- **Web with OPFS**: `createOpfsSqliteDriver()` -- `@journeyapps/wa-sqlite` compiled to WASM, backed by Origin Private File System (worker-hosted, async-only API surface)
- **Web without OPFS**: `IndexedDB` adapters for storage and offline queue (no local SQLite queries -- hooks fall back to remote mode); `storageFallbackReason` records why OPFS was skipped (capability missing vs. init failure)

**Crypto adapters:**

- **Native**: `ReactNativeSodiumAdapter` from `@pluralscape/crypto/react-native`, with optional native `memzero` for secure key wiping
- **Web**: `WasmSodiumAdapter` from `@pluralscape/crypto/wasm` -- libsodium compiled to WebAssembly

Platform detection runs once at startup (`detectPlatform()`) and the result is immutable for the session.

### Connection Management

The connection layer (`apps/mobile/src/connection/`) manages two real-time channels:

**SSE Client** (`SseClient`):

- Connects to `/api/v1/notifications/stream` with Bearer auth
- Uses `@microsoft/fetch-event-source` for cross-platform SSE
- Tracks `Last-Event-ID` for resume on reconnect
- Lifecycle callbacks (`onConnected`, `onDisconnected`, `onError`) drive the state machine

**Connection State Machine** (`ConnectionStateMachine`):

States and transitions:

```
disconnected --CONNECT--> connecting --CONNECTED--> connected
                              |                         |
                        CONNECTION_LOST           CONNECTION_LOST
                              |                         |
                              v                         v
                           backoff                 reconnecting
                              |                         |
                        BACKOFF_COMPLETE              RETRY
                              |                         |
                              v                         v
                         reconnecting               connecting
```

- Jittered exponential backoff: base 1s, multiplier 2x, cap 30s, +/-25% jitter
- `ConnectionManager` orchestrates the SSE client and state machine, auto-reconnecting with saved credentials
- `ConnectionProvider` auto-connects when auth reaches `unlocked` and disconnects on lock/logout
- State is exposed via `useSyncExternalStore` for tear-free React integration

**WebSocket Manager** (`WsManager`):

A separate WebSocket channel handles CRDT sync. Created by `SyncProvider`, it follows the same backoff pattern and exposes a `useSyncExternalStore`-compatible interface. The WebSocket adapter is wired to the event bus for `ws:connected` / `ws:disconnected` events.

### Testing

Run mobile unit tests from the monorepo root:

```bash
pnpm vitest run --project mobile
```

Tests use Vitest with React Testing Library. The test infrastructure stubs platform-specific modules (Expo, React Native) and provides test helpers for injecting provider context without mounting the full provider tree.

Key test patterns:

- Auth state machine tests verify all state transitions exhaustively
- Hook tests use the exported context objects (`AuthCtx`, `DataLayerCtx`, `SyncCtx`) to inject stub values
- Connection and SSE tests verify backoff timing and reconnection behavior
- Row transform tests cover SQLite row parsing for every domain entity

---

## Part 3 -- Understanding the Client (API Consumers / Self-Hosters)

### API Communication

The mobile app uses **tRPC** (not REST) for all standard API calls. The tRPC client is configured with:

- **httpBatchLink** for queries and mutations -- batches concurrent requests into a single HTTP call
- **httpSubscriptionLink** for real-time subscriptions via SSE
- **loggerLink** (dev only) for error logging

The REST client (`RestClientProvider`) exists for operations not covered by tRPC, such as blob uploads.

### Auth Flow

```
Login screen
    |
    v
POST /auth/login --> sessionToken, salt, accountId, systemId
    |
    v
Argon2id(password, salt) --> masterKey
    |
    v
Derive identity keys (sign + box) from masterKey
    |
    v
AuthStateMachine.dispatch(LOGIN) --> state: "unlocked"
    |
    v
Token persisted to secure storage (native) or memory (web)
    |
    v
Providers initialize: SystemProvider, CryptoProvider, BucketKeyProvider
    |
    v
ConnectionProvider auto-connects SSE
    |
    v
SyncProvider creates engine, connects WebSocket, bootstraps CRDT documents
    |
    v
BootstrapGate unblocks --> AuthGate renders app
```

### Auth States

| State             | Session token  | Master key  | App behavior                                              |
| ----------------- | -------------- | ----------- | --------------------------------------------------------- |
| `unauthenticated` | No             | No          | Redirected to login screen                                |
| `unlocked`        | Yes            | Yes         | Full app access, sync active, decryption available        |
| `locked`          | Yes (retained) | No (zeroed) | Lock screen shown, React Query cache cleared, sync paused |

Transitioning from `unlocked` to `locked` zeros the master key via `sodium.memzero()`. The session token is retained so the user can unlock with their password without re-authenticating. Logout clears both the token and key, returning to `unauthenticated`.

### Sync

The sync engine uses Automerge CRDT documents, encrypted and relayed through the server. The server never sees plaintext:

1. **Bootstrap** -- on first connect, the engine downloads all CRDT document headers, then materializes them into local SQLite tables
2. **Steady state** -- incoming changes arrive via WebSocket, are decrypted with the `DocumentKeyResolver` (which uses the master key and bucket key cache), merged into local Automerge documents, and materialized into SQLite
3. **Outgoing changes** -- mutations sent via tRPC produce CRDT operations on the server, which are relayed back through the sync channel

If bootstrap fails 3 times, the app falls back to remote-only mode (tRPC queries hit the server directly) and displays a banner warning.

For full sync protocol details, see [`sync-protocol.md`](sync-protocol.md).

### Offline Behavior

- **Reads**: served from local SQLite. The `QueryInvalidator` listens to materialization events from the sync engine and invalidates React Query cache entries, keeping the UI current.
- **Writes**: mutations go through tRPC. When offline, they are queued locally (via the platform's offline queue adapter) and replayed on reconnect.
- **Conflict resolution**: Automerge CRDTs handle concurrent edits deterministically. No manual conflict resolution is required.
- **Degraded mode**: if the platform lacks SQLite support (web without OPFS), the app operates in remote-only mode -- all reads and writes go through tRPC with no local cache beyond React Query's in-memory store.
