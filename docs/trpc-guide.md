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
// Query
const { data, isLoading } = trpc.member.list.useQuery({ systemId });

// Mutation
const createMember = trpc.member.create.useMutation();
createMember.mutate({ systemId, name: "Iris", pronouns: "she/her" });

// Invalidate after mutation
const utils = trpc.useUtils();
await utils.member.list.invalidate({ systemId });
```

React Query handles deduplication and retry. Do not add manual idempotency keys to tRPC calls.

### Available routers

| Router                | Domain                                    |
| --------------------- | ----------------------------------------- |
| `account`             | Account management and deletion           |
| `acknowledgement`     | Acknowledgement records                   |
| `analytics`           | System usage analytics                    |
| `api-key`             | API key issuance and revocation           |
| `auth`                | Authentication (login, register, session) |
| `blob`                | Binary asset upload and retrieval         |
| `board-message`       | Message board posts                       |
| `bucket`              | Privacy buckets                           |
| `channel`             | Communication channels                    |
| `check-in-record`     | Check-in entries                          |
| `custom-front`        | Custom front states (e.g. "Dissociated")  |
| `device-token`        | Push notification tokens                  |
| `field`               | Custom fields                             |
| `friend-code`         | Friend code generation and redemption     |
| `friend`              | Friend relationships                      |
| `fronting-comment`    | Comments on fronting sessions             |
| `fronting-report`     | Fronting history reports                  |
| `fronting-session`    | Active and past fronting sessions         |
| `group`               | Member groups                             |
| `innerworld`          | Innerworld locations and map data         |
| `lifecycle-event`     | Member lifecycle events                   |
| `member-photo`        | Member profile photos                     |
| `member`              | System members (headmates)                |
| `message`             | Direct messages                           |
| `note`                | Notes and journal entries                 |
| `notification-config` | Notification preferences                  |
| `poll`                | Polls                                     |
| `relationship`        | Member-to-member relationships            |
| `snapshot`            | System snapshots for sync                 |
| `structure`           | System structure metadata                 |
| `system-settings`     | System-level settings                     |
| `system`              | System (account) profile                  |
| `timer-config`        | Timers                                    |
| `webhook-config`      | Webhook configuration                     |
| `webhook-delivery`    | Webhook delivery log                      |

### Auth levels

- **Public** — no session required (e.g. `auth.login`, `auth.register`)
- **Protected** — valid session required
- **System-scoped** — session must belong to the system that owns the resource; enforced by middleware on every mutating procedure

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
