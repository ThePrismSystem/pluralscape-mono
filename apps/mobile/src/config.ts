import Constants from "expo-constants";

const DEV_API_BASE_URL = "http://localhost:3000";

/**
 * Hostnames permitted to use plaintext `ws://`. Anything else must use TLS
 * (`wss://`) — a misconfigured production build that downgraded to `ws://`
 * would otherwise expose session tokens and sync payloads on the wire.
 */
const PLAINTEXT_WS_ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isPlaintextHostAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    return PLAINTEXT_WS_ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function getWsUrl(): string {
  const base = getApiBaseUrl();
  const wsBase = base.replace(/^http(s?)/, "ws$1");
  const wsUrl = `${wsBase}/sync`;
  // Reject plaintext `ws://` on non-loopback hosts. In production builds the
  // API URL is baked in at build time via app.config — catching a bad
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

export function getApiBaseUrl(): string {
  const extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra;
  const configured: unknown = extra?.apiBaseUrl;
  if (typeof configured === "string" && configured.length > 0) {
    return configured;
  }
  return DEV_API_BASE_URL;
}
