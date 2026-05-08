# @pluralscape/api

Hono API on Bun. Hosts the tRPC internal transport and the REST public
transport against a shared service layer. See `docs/adr/003-api-framework.md`
for transport choices and `docs/adr/035-i18n-ota-delivery.md` for the i18n
cache wiring.

## Runtime dependencies

### `VALKEY_URL`

Connection string for a shared Valkey (or Redis-compatible) endpoint. When
set at startup, the API wires a single ioredis client and shares it across:

- **Rate limiting** — atomic INCR + PEXPIRE Lua script, per account / IP.
- **Login throttling** — per-identifier failed-attempt counters.
- **Idempotency store** — request-replay dedupe for mutation endpoints.
- **Sync pub/sub** — cross-instance WebSocket broadcast fan-out.
- **i18n OTA cache** — Crowdin distribution responses (see ADR 035).

Multi-replica deployments require a coherent shared store. Without one, each
replica maintains an independent view, and rate-limit / idempotency
guarantees degrade to per-process.

### In-memory cache fallback

When `VALKEY_URL` is unset, the API falls back to a **per-process in-memory
cache** for i18n OTA responses, rate-limit counters, and idempotency state.

- **Safe for:** single-instance deployments, local development, E2E test
  suites.
- **Not safe for:** multi-replica production. Each replica sees a divergent
  cache, breaking rate-limit fairness and idempotency guarantees.

Under `NODE_ENV=production` the API **refuses to start** without `VALKEY_URL`
unless `ALLOW_IN_MEMORY_CACHE=1` is set. The opt-in is deliberate: it forces a
conscious choice for single-instance prod rather than silent degradation.

When the fallback is active at startup, the logger emits a `WARN` with
`valkey-cache: falling back to per-process in-memory cache — ...` so operators
have a searchable signal.
