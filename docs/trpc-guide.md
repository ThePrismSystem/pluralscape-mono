# tRPC Guide

tRPC is the internal typed API for the Pluralscape mobile client. REST is the public API. Both transports call the same service layer. See ADR 003 and ADR 032.

---

## Mobile developers

### Client setup

The tRPC client is provided by `@pluralscape/api-client`:

```ts
import { trpc } from "@pluralscape/api-client/trpc";
```

`trpc` is a `createTRPCReact<AppRouter>()` instance. Wrap your component tree with the provider once in the app root — the client is pre-configured with auth headers and the API base URL from environment config.

### Usage with React Query hooks

```ts
// Query — the active system is resolved from session context, not input
const { data, isLoading } = trpc.member.list.useQuery({ includeArchived: false });

// Mutation — member payloads are end-to-end encrypted; pass the sealed blob
const createMember = trpc.member.create.useMutation();
createMember.mutate({ encryptedData });

// Invalidate after mutation
const utils = trpc.useUtils();
await utils.member.list.invalidate();
```

React Query handles deduplication and retry. Do not add manual idempotency keys to tRPC calls.

### Available routers

Router keys match the object composed in `apps/api/src/trpc/root.ts` — use them as-written on the client (`trpc.frontingSession.list.useQuery(...)`).

| Router               | Domain                                    |
| -------------------- | ----------------------------------------- |
| `account`            | Account management and deletion           |
| `acknowledgement`    | Acknowledgement records                   |
| `analytics`          | System usage analytics                    |
| `apiKey`             | API key issuance and revocation           |
| `auth`               | Authentication (login, register, session) |
| `blob`               | Binary asset upload and retrieval         |
| `boardMessage`       | Message board posts                       |
| `bucket`             | Privacy buckets                           |
| `channel`            | Communication channels                    |
| `checkInRecord`      | Check-in entries                          |
| `customFront`        | Custom front states (e.g. "Dissociated")  |
| `deviceToken`        | Push notification tokens                  |
| `field`              | Custom fields                             |
| `friend`             | Friend relationships                      |
| `friendCode`         | Friend code generation and redemption     |
| `frontingComment`    | Comments on fronting sessions             |
| `frontingReport`     | Fronting history reports                  |
| `frontingSession`    | Active and past fronting sessions         |
| `group`              | Member groups                             |
| `i18n`               | Localization manifest and namespace fetch |
| `importEntityRef`    | Import entity cross-references            |
| `importJob`          | Import job orchestration and status       |
| `innerworld`         | Innerworld locations and map data         |
| `lifecycleEvent`     | Member lifecycle events                   |
| `member`             | System members (headmates)                |
| `memberPhoto`        | Member profile photos                     |
| `message`            | Direct messages                           |
| `note`               | Notes and journal entries                 |
| `notificationConfig` | Notification preferences                  |
| `poll`               | Polls                                     |
| `relationship`       | Member-to-member relationships            |
| `snapshot`           | System snapshots for sync                 |
| `structure`          | System structure metadata                 |
| `system`             | System (account) profile                  |
| `systemSettings`     | System-level settings                     |
| `timerConfig`        | Timers                                    |
| `webhookConfig`      | Webhook configuration                     |
| `webhookDelivery`    | Webhook delivery log                      |

### Auth levels

- **Public** — no session required (e.g. `auth.login`, `auth.register`)
- **Protected** — valid session required
- **System-scoped** — session must belong to the system that owns the resource; enforced by middleware on every mutating procedure

API key requests additionally pass through the fail-closed scope gate (`scopeGateMiddleware`), which looks up each procedure path in the shared `SCOPE_REGISTRY.trpc`. Procedures with no registry entry are rejected with `FORBIDDEN` — the same registry powers REST per-endpoint scope enforcement.

---

## API contributors

### Adding a new endpoint

See [CONTRIBUTING.md — Adding API Endpoints](../../CONTRIBUTING.md#adding-api-endpoints) for the full checklist and rate limit categories.

### REST-only allowlist

Endpoints in `apps/api/scripts/trpc-parity.config.ts` are intentionally excluded from the tRPC surface:

| Route                          | Reason                                                   |
| ------------------------------ | -------------------------------------------------------- |
| `GET /`                        | Root status — infrastructure, not a domain operation     |
| `GET /health`                  | Health check — infrastructure, not a domain operation    |
| `GET /v1/notifications/stream` | SSE stream — transport-specific; tRPC uses subscriptions |

To add a new exception: add an `AllowlistEntry` to `REST_ONLY_ALLOWLIST`, document the reason, and run `pnpm trpc:parity` to confirm the check still passes. New entries are reviewed at code review time.
