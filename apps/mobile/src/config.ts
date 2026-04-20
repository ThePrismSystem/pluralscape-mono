import Constants from "expo-constants";

/**
 * Hostnames permitted to use plaintext `http://` / `ws://`. Anything else
 * must use TLS (`https://` / `wss://`) — a misconfigured production build
 * that downgraded to `http://` would otherwise expose session tokens and
 * sync payloads on the wire.
 */
const PLAINTEXT_ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True in development builds (Metro, dev client). React Native exposes
 * `__DEV__` as a global; we tolerate its absence here so the config module
 * is safe to import in any host (including vitest).
 */
function isDevBuild(): boolean {
  const dev = (globalThis as { __DEV__?: unknown }).__DEV__;
  return dev === true;
}

export function getWsUrl(): string {
  // `getApiBaseUrl()` is the single choke point for scheme validation, so
  // `base` is guaranteed to be https://… or an http://loopback URL here.
  // A plain `/^http/ → ws/` regex therefore cannot produce a plaintext
  // `ws://` to a non-loopback host.
  const base = getApiBaseUrl();
  const wsBase = base.replace(/^http(s?)/, "ws$1");
  return `${wsBase}/sync`;
}

/**
 * Reads `apiBaseUrl` from Expo config extras. The value is injected at build
 * time via `eas.json` per-profile extras (dev / preview / production); there
 * is no source-tree default. Production and preview builds must use
 * `https://`. Development builds may use `http://` but only for loopback
 * hosts (localhost, 127.0.0.1, ::1) so a misconfigured dev environment
 * cannot silently downgrade real traffic.
 *
 * Throws a descriptive error if:
 *   - the value is missing (app.json/eas.json misconfiguration)
 *   - the value is not a non-empty string
 *   - the value is not a parseable URL
 *   - the scheme is `http:` outside a dev build
 *   - the scheme is `http:` in a dev build but the host is not loopback
 *   - the scheme is anything other than `http:` / `https:`
 */
export function getApiBaseUrl(): string {
  // `extra` is typed as `{ [k: string]: any }` by @expo/config-types, so an
  // explicit `unknown` annotation is required to force narrowing before use.
  const configured: unknown = Constants.expoConfig?.extra?.apiBaseUrl;

  if (typeof configured !== "string" || configured.length === 0) {
    throw new Error(
      "apiBaseUrl is not configured. Set it via eas.json per-profile extras " +
        '(e.g., `{ "build": { "production": { "extra": { "apiBaseUrl": "https://api.pluralscape.app" } } } }`).',
    );
  }

  // Parsing up-front normalizes scheme casing (`HTTPS://…` → `https:`) and
  // rejects malformed inputs like `http:example.com` (missing `//`) before
  // any `startsWith` check could wave them through.
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(
      `apiBaseUrl is not a valid URL: ${configured}. Expected https:// (or http:// for a dev-build loopback).`,
    );
  }

  switch (parsed.protocol) {
    case "https:":
      return configured;
    case "http:":
      if (!isDevBuild()) {
        throw new Error(
          `Refusing plaintext apiBaseUrl (${configured}) in a non-development build. ` +
            `Production and preview must use https://.`,
        );
      }
      if (!PLAINTEXT_ALLOWED_HOSTS.has(parsed.hostname)) {
        throw new Error(
          `Refusing plaintext apiBaseUrl (${configured}) for a non-loopback host in a dev build. ` +
            `Use https:// or point at localhost/127.0.0.1/::1.`,
        );
      }
      return configured;
    default:
      throw new Error(
        `apiBaseUrl has an unsupported scheme: ${parsed.protocol}. Expected https:// (or http:// for a dev-build loopback).`,
      );
  }
}
