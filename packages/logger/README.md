# `@pluralscape/logger`

Runtime-scoped logger factories for Pluralscape clients. Provides the shared `Logger` contract from `@pluralscape/types` plus concrete implementations per runtime.

Currently ships the mobile (React Native / Expo / Hermes) logger. The API runtime (Bun/Node) has its own logger at `apps/api/src/lib/logger.ts`; a web sibling will land alongside the web app.

## Overview

`Logger` is the structured-logging contract used across the app. Defined in `@pluralscape/types` as three methods — `info`, `warn`, `error` — each taking a `message: string` and optional `data?: Record<string, unknown>`. This package produces runtime-specific implementations of that contract.

Every logger factory in this package applies **PII redaction** by default. Callers can supply a custom redactor or opt out with `null` after manually sanitizing values. The default redactor walks the payload recursively, masking values under PII-adjacent keys, and breaks cycles with a `WeakSet` guard so self-referential payloads never crash the call site.

## Key Exports

### Root (`@pluralscape/logger`)

| Export                | Kind     | Purpose                                                    |
| --------------------- | -------- | ---------------------------------------------------------- |
| `Logger`              | type     | Re-exported from `@pluralscape/types`; the shared contract |
| `createMobileLogger`  | function | Factory for React Native / Expo (console-backed)           |
| `MobileLoggerOptions` | type     | Options bag for `createMobileLogger`                       |
| `MobileLoggerPayload` | type     | `Record<string, unknown>` — structured payload shape       |

### Mobile entry (`@pluralscape/logger/mobile`)

Direct subpath into `src/mobile.ts`, kept distinct so platform-specific bundlers can split runtime-specific code. Surfaces the redaction internals that the root barrel does not re-export.

| Export                | Kind     | Purpose                                                               |
| --------------------- | -------- | --------------------------------------------------------------------- |
| `createMobileLogger`  | function | Factory returning a `Logger` that writes through `globalThis.console` |
| `MobileLoggerOptions` | type     | Options bag for `createMobileLogger`                                  |
| `MobileLoggerPayload` | type     | `Record<string, unknown>` — structured payload shape                  |
| `defaultRedact`       | function | Recursive PII masking — used as the default payload transform         |
| `DEFAULT_REDACT_KEYS` | const    | Case-insensitive substrings that trigger redaction                    |

## Mobile logger

```ts
import { createMobileLogger } from "@pluralscape/logger/mobile";

const log = createMobileLogger();

log.info("sync started", { queueSize: 12 });
log.warn("retrying request", { attempt: 2, url: "/v1/members" });
log.error("upload failed", { error: err.message, apiKey: "sk_..." });
// → console.error('upload failed {"error":"network","apiKey":"[redacted]"}')
```

### Options

```ts
createMobileLogger({
  // Custom redactor (fully replaces the default)
  redact: (payload) => ({ ...payload, extra: "masked" }),
});

createMobileLogger({
  // Explicit opt-out — payload passes through untouched
  redact: null,
});

createMobileLogger({
  // Swap the console target (useful in tests)
  console: capturedCalls,
});
```

### Default redaction keys

Case-insensitive substring matches against any key in the payload trigger replacement with `"[redacted]"`:

```
password, passwordHash, token, accessToken, refreshToken, apiKey,
authorization, secret, privateKey, recoveryKey, email, pepper
```

The walk is recursive and handles arrays, nested objects, and cycles (substituted as `"[cycle]"`). Values that fail `JSON.stringify` fall through to `"[unserializable]"`.

## Testing

Unit tests in `src/__tests__/` cover:

- `defaultRedact` — key matching (exact, substring, case-insensitive), nested objects, arrays, cycles.
- `createMobileLogger` — message passthrough, bare-message (no payload) formatting, custom redactor override, default-redaction of top-level / nested / array PII keys, case-insensitive substring matching, `redact: null` opt-out, `globalThis.console` fallback, circular payload survival, BigInt (unserializable) payload survival.

Run via `pnpm vitest run --project logger`.

## Design rationale

The mobile logger intentionally wraps `console.{info,warn,error}` rather than a third-party logging framework: React Native's log pipeline (Metro, `react-native log-ios|log-android`, Hermes trace tooling) reads `console` output directly, and payloads serialize as JSON suffixes so they remain grep-friendly in captured logs.

PII redaction is enforced by default so developers cannot accidentally ship identifying data into device logs or crash reports. Opting out requires an explicit `redact: null` — matching the Pluralscape principle that privacy boundaries default to maximum restriction.
