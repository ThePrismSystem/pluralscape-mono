import Constants from "expo-constants";

/**
 * Hostnames permitted to use plaintext `http://` / `ws://`. Anything else
 * must use TLS (`https://` / `wss://`) — a misconfigured production build
 * that downgraded to `http://` would otherwise expose session tokens and
 * sync payloads on the wire.
 */
const PLAINTEXT_ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isPlaintextHostAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    return PLAINTEXT_ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

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
  const base = getApiBaseUrl();
  const wsBase = base.replace(/^http(s?)/, "ws$1");
  const wsUrl = `${wsBase}/sync`;
  // Reject plaintext `ws://` on non-loopback hosts. In production builds the
  // API URL is baked in at build time via eas.json extras — catching a bad
  // apiBaseUrl here turns a silent downgrade into a visible failure before
  // any session token is sent.
  if (wsUrl.startsWith("ws://") && !isPlaintextHostAllowed(wsUrl)) {
    throw new Error(
      `Refusing to open a plaintext WebSocket to a non-loopback host: ${wsUrl}. ` +
        `Configure apiBaseUrl to use https:// (which maps to wss://).`,
    );
  }
  return wsUrl;
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
 *   - the scheme is `http://` outside a dev build
 *   - the scheme is `http://` in a dev build but the host is not loopback
 */
export function getApiBaseUrl(): string {
  const extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra;
  const configured: unknown = extra?.apiBaseUrl;

  if (typeof configured !== "string" || configured.length === 0) {
    throw new Error(
      "apiBaseUrl is not configured. Set it via eas.json per-profile extras " +
        '(e.g., `{ "build": { "production": { "extra": { "apiBaseUrl": "https://api.pluralscape.app" } } } }`).',
    );
  }

  if (configured.startsWith("https://")) {
    return configured;
  }

  if (configured.startsWith("http://")) {
    if (!isDevBuild()) {
      throw new Error(
        `Refusing plaintext apiBaseUrl (${configured}) in a non-development build. ` +
          `Production and preview must use https://.`,
      );
    }
    if (!isPlaintextHostAllowed(configured)) {
      throw new Error(
        `Refusing plaintext apiBaseUrl (${configured}) for a non-loopback host in a dev build. ` +
          `Use https:// or point at localhost/127.0.0.1/::1.`,
      );
    }
    return configured;
  }

  throw new Error(
    `apiBaseUrl has an unsupported scheme: ${configured}. Expected https:// (or http:// for a dev-build loopback).`,
  );
}
