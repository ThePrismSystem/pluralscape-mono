# @pluralscape/api-client

Typed API client bindings for the Pluralscape API, covering both REST and tRPC interfaces.

## Overview

This package exposes two client interfaces that serve different consumers. The REST client
(main entry `@pluralscape/api-client`) wraps the public OpenAPI specification using
`openapi-fetch`, providing full type safety derived from the generated `api-types.ts` file.
It is used by E2E tests and any external consumer that communicates with the HTTP API directly.

The tRPC client (sub-entry `@pluralscape/api-client/trpc`) uses `@trpc/react-query` and is
typed against `AppRouter` from `@pluralscape/api`. This is the primary interface used by the
Expo mobile app — it provides React Query hooks, end-to-end input/output type inference, and
automatic request batching.

REST/tRPC parity is enforced in CI (`pnpm trpc:parity`). Every tRPC procedure must have a
corresponding REST route and vice versa. Both interfaces stay in sync with the server by
design — neither is a secondary or optional path.

## Key Exports

**Main entry (`@pluralscape/api-client`)**

| Export                    | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `createApiClient(config)` | Creates an `openapi-fetch` client bound to the Pluralscape REST API |
| `ApiClientConfig`         | Configuration interface (`baseUrl`, `getToken`, `platform`)         |
| `ApiClient`               | Return type of `createApiClient`                                    |
| `paths`                   | Generated path/operation types from `docs/openapi.yaml`             |
| `MaybeOptionalInit`       | Re-exported from `openapi-fetch` for typed request init helpers     |

**tRPC sub-entry (`@pluralscape/api-client/trpc`)**

| Export            | Description                                                                             |
| ----------------- | --------------------------------------------------------------------------------------- |
| `trpc`            | `createTRPCReact<AppRouter>()` instance — use to call `.useQuery`, `.useMutation`, etc. |
| `AppRouter`       | The full tRPC router type from `@pluralscape/api`                                       |
| `RouterInput`     | Inferred input types for all procedures (`inferRouterInputs<AppRouter>`)                |
| `RouterOutput`    | Inferred output types for all procedures (`inferRouterOutputs<AppRouter>`)              |
| `MAX_URL_LENGTH`  | `2083` — URL length threshold at which `httpBatchLink` splits batches                   |
| `MAX_BATCH_ITEMS` | `10` — maximum operations per batch request                                             |

## Usage

### REST client

```typescript
import { createApiClient } from "@pluralscape/api-client";

const client = createApiClient({
  baseUrl: "https://api.pluralscape.app",
  getToken: () => sessionStorage.getItem("session_token"),
  platform: "web", // or "mobile" — sets X-Client-Platform header
});

// Fully typed — path, params, and response all inferred from the OpenAPI spec
const { data, error } = await client.GET("/api/v1/systems/{systemId}/members", {
  params: { path: { systemId: "sys_abc123" } },
});
```

The `getToken` callback may be synchronous or async and return `string | null`. When
`null` is returned, the `Authorization` header is omitted entirely.

### tRPC client (mobile app)

Set up the tRPC provider once at the app root:

```typescript
import { trpc, MAX_URL_LENGTH, MAX_BATCH_ITEMS } from "@pluralscape/api-client/trpc";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/trpc`,
      maxURLLength: MAX_URL_LENGTH,
      maxItems: MAX_BATCH_ITEMS,
      headers: () => ({
        Authorization: `Bearer ${getSessionToken()}`,
      }),
    }),
  ],
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

Call procedures in components:

```typescript
import { trpc } from "@pluralscape/api-client/trpc";

function MemberList({ systemId }: { systemId: string }) {
  const { data } = trpc.member.list.useQuery({ systemId, limit: 20 });
  // ...
}
```

Use `RouterInput` and `RouterOutput` for typed helper functions:

```typescript
import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type MemberListInput = RouterInput["member"]["list"];
type MemberListOutput = RouterOutput["member"]["list"];
```

## Dependencies

| Package             | Role                                                     |
| ------------------- | -------------------------------------------------------- |
| `openapi-fetch`     | HTTP client with OpenAPI path/param/response type safety |
| `@trpc/client`      | Core tRPC client (link chain, batch logic)               |
| `@trpc/react-query` | React Query integration for tRPC procedures              |

Dev dependencies include `openapi-typescript` (type generation) and `@trpc/server` (router
type inference). `@pluralscape/api` is a dev-only workspace dependency — it is never bundled,
only used for `AppRouter` type inference at build time.

## Type Generation

REST types are generated from the OpenAPI specification at `docs/openapi.yaml` and written to
`src/generated/api-types.ts`. Run generation from the monorepo root:

```bash
pnpm --filter @pluralscape/api-client generate
```

This executes `scripts/generate-types.ts`, which calls `openapi-typescript` and writes the
result to `src/generated/api-types.ts`. Commit both the spec and the generated file together.
The generated file is the source of truth for all REST path and response types.

## Testing

Unit tests only — no integration variant exists for this package.

```bash
pnpm vitest run --project api-client
```

Tests cover `createApiClient` construction, `Authorization` header attachment when a token is
present, and omission of the header when `getToken` returns `null`.
